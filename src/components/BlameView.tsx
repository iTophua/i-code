import { useEffect, useState, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useGitStore } from "../stores/gitStore";
import { invoke } from "@tauri-apps/api/core";
import { getLanguage } from "../utils/language";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME } from "../monaco/theme";
import "../monaco/setup";
import { toast } from "../stores/toastStore";

interface BlameInfo {
  hash: string;
  author: string;
  time: string;
  line: number;
}

/**
 * Blame 视图: 显示文件内容 + 每行的 blame 信息(Monaco 行尾装饰)
 */
export function BlameView({ filePath, fileName }: { filePath: string; fileName: string }) {
  const { repoRoot, blameFile } = useGitStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState("");
  const [blameData, setBlameData] = useState<Map<number, BlameInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!repoRoot) return;
      const relPath = filePath.startsWith(repoRoot)
        ? filePath.slice(repoRoot.length + 1)
        : filePath;
      try {
        // 读文件内容
        const [fileContent] = await invoke<[string, string]>("read_file", { filePath });
        setContent(fileContent);

        // 读 blame
        const blameOut = await blameFile(relPath);
        const blameMap = parseBlame(blameOut);
        setBlameData(blameMap);
        setLoading(false);
      } catch (e) {
        toast.error(`加载 blame 失败: ${e}`);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  const handleMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    defineIThemes(monaco);
    monaco.editor.setTheme(ICODE_DARK_THEME);

    // 应用 blame 装饰
    if (blameData.size > 0) {
      applyBlameDecorations(ed, blameData);
    }
  };

  // blameData 更新时重新装饰
  useEffect(() => {
    if (editorRef.current && blameData.size > 0) {
      applyBlameDecorations(editorRef.current, blameData);
    }
  }, [blameData]);

  if (loading) {
    return <div className="editor-loading">加载 blame...</div>;
  }

  return (
    <div className="blame-view">
      <div className="blame-view__header">
        <span className="blame-view__title">🔍 Blame: {fileName}</span>
      </div>
      <div className="blame-view__body">
        <Editor
          value={content}
          language={getLanguage(fileName)}
          onMount={handleMount}
          options={getEditorOptions({
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: "on",
          })}
        />
      </div>
    </div>
  );
}

/** 解析 git blame --porcelain 输出 */
function parseBlame(output: string): Map<number, BlameInfo> {
  const map = new Map<number, BlameInfo>();
  const lines = output.split("\n");
  let currentLine = 0;
  let currentHash = "";
  let currentAuthor = "";
  let currentTime = "";
  let hasData = false;

  for (const line of lines) {
    if (/^[0-9a-f]{40}/.test(line)) {
      // 保存上一条
      if (hasData && currentLine > 0) {
        map.set(currentLine, { hash: currentHash, author: currentAuthor, time: currentTime, line: currentLine });
      }
      const parts = line.split(/\s+/);
      currentHash = parts[0].slice(0, 8);
      currentLine = parseInt(parts[2]) || 0;
      currentAuthor = "";
      currentTime = "";
      hasData = false;
    } else if (line.startsWith("author ")) {
      currentAuthor = line.slice(7).trim();
      hasData = true;
    } else if (line.startsWith("author-time ")) {
      const ts = parseInt(line.slice(12));
      const d = new Date(ts * 1000);
      currentTime = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }
  }
  // 最后一条
  if (hasData && currentLine > 0) {
    map.set(currentLine, { hash: currentHash, author: currentAuthor, time: currentTime, line: currentLine });
  }
  return map;
}

/** 应用 blame 装饰到 Monaco */
function applyBlameDecorations(
  ed: editor.IStandaloneCodeEditor,
  blame: Map<number, BlameInfo>
) {
  const decorations: editor.IModelDeltaDecoration[] = [];
  for (const [lineNum, info] of blame) {
    decorations.push({
      range: {
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 1,
      },
      options: {
        after: {
          content: `  ${info.author} · ${info.time} · ${info.hash}`,
          inlineClassName: "blame-decoration",
        },
        isWholeLine: true,
      },
    });
  }
  ed.deltaDecorations([], decorations);
}
