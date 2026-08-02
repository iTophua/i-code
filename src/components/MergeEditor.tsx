import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGitStore } from "../stores/gitStore";
import { getLanguage } from "../utils/language";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { toast } from "../stores/toastStore";
import { GitMerge } from "lucide-react";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { getEditorOptions, defineIThemes, ICODE_DARK_THEME } from "../monaco/theme";
import "../monaco/setup";
import "../styles/merge-editor.css";

interface ConflictBlock {
  start: number;
  end: number;
  ours: string;
  theirs: string;
}

/**
 * 三向合并编辑器(冲突解决)
 * 检测文件中的 <<<<<<< / ======= / >>>>>>> 标记
 * 提供快捷按钮: 接受当前 / 接受传入 / 全部保留
 */
export function MergeEditor({ filePath, fileName }: { filePath: string; fileName: string }) {
  const repoRoot = useGitStore((s) => s.repoRoot);
  const [content, setContent] = useState("");
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    (async () => {
      const [raw] = await invoke<[string, string]>("read_file", { filePath });
      setContent(raw);
      setResolved(raw);
    })();
  }, [filePath]);

  // 解析冲突块
  const conflicts = useMemo<ConflictBlock[]>(() => {
    const blocks: ConflictBlock[] = [];
    const lines = content.split("\n");
    let i = 0;
    while (i < lines.length) {
      if (lines[i].startsWith("<<<<<<<")) {
        const start = i;
        const oursLines: string[] = [];
        const theirsLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("=======")) {
          oursLines.push(lines[i]);
          i++;
        }
        i++; // skip =======
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          theirsLines.push(lines[i]);
          i++;
        }
        i++; // skip >>>>>>>
        blocks.push({
          start,
          end: i,
          ours: oursLines.join("\n"),
          theirs: theirsLines.join("\n"),
        });
      } else {
        i++;
      }
    }
    return blocks;
  }, [content]);

  // 解决单个冲突
  const resolveConflict = (idx: number, choice: "ours" | "theirs" | "both") => {
    const block = conflicts[idx];
    const lines = resolved.split("\n");
    let replacement: string[];
    if (choice === "ours") replacement = block.ours.split("\n");
    else if (choice === "theirs") replacement = block.theirs.split("\n");
    else replacement = [...block.ours.split("\n"), "", block.theirs.split("\n")].flat();

    const newLines = [...lines.slice(0, block.start), ...replacement, ...lines.slice(block.end)];
    setResolved(newLines.join("\n"));
    toast.success(`冲突 ${idx + 1} 已解决`);
  };

  // 解决全部
  const resolveAll = (choice: "ours" | "theirs" | "both") => {
    let result = resolved;
    // 从后往前解决(避免偏移)
    for (let i = conflicts.length - 1; i >= 0; i--) {
      const block = conflicts[i];
      const lines = result.split("\n");
      let replacement: string[];
      if (choice === "ours") replacement = block.ours.split("\n");
      else if (choice === "theirs") replacement = block.theirs.split("\n");
      else replacement = [...block.ours.split("\n"), "", block.theirs.split("\n")].flat();
      const newLines = [...lines.slice(0, block.start), ...replacement, ...lines.slice(block.end)];
      result = newLines.join("\n");
    }
    setResolved(result);
    toast.success(`全部 ${conflicts.length} 个冲突已解决`);
  };

  // 保存解决结果
  const saveResolved = async () => {
    try {
      await invoke("write_file", { filePath, content: resolved });
      // 如果在 git 仓库, 暂存该文件
      if (repoRoot) {
        const relPath = filePath.startsWith(repoRoot)
          ? filePath.slice(repoRoot.length + 1)
          : filePath;
        await invoke("git_add", { path: repoRoot, files: [relPath] });
      }
      toast.success("冲突已解决并暂存");
      useFileTreeStore.getState().refreshTree();
      useGitStore.getState().refresh(repoRoot || filePath);
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    }
  };

  const handleMount: OnMount = (_ed, monaco) => {
    defineIThemes(monaco);
    monaco.editor.setTheme(ICODE_DARK_THEME);
  };

  return (
    <div className="merge-editor">
      <div className="merge-editor__header">
        <GitMerge size={18} />
        <span className="merge-editor__title">解决冲突: {fileName}</span>
        <span className="merge-editor__count">{conflicts.length} 个冲突</span>
        <div className="merge-editor__actions">
          <button className="tool-btn" onClick={() => resolveAll("ours")}>全部接受当前</button>
          <button className="tool-btn" onClick={() => resolveAll("theirs")}>全部接受传入</button>
          <button className="tool-btn tool-btn--primary" onClick={saveResolved} disabled={resolved === content}>
            保存并暂存
          </button>
        </div>
      </div>

      <div className="merge-editor__conflicts">
        {conflicts.map((block, idx) => (
          <div key={idx} className="conflict-block">
            <div className="conflict-block__header">
              <span>冲突 {idx + 1}</span>
              <div className="conflict-block__actions">
                <button className="tool-btn" onClick={() => resolveConflict(idx, "ours")}>接受当前</button>
                <button className="tool-btn" onClick={() => resolveConflict(idx, "theirs")}>接受传入</button>
                <button className="tool-btn" onClick={() => resolveConflict(idx, "both")}>都保留</button>
              </div>
            </div>
            <div className="conflict-block__diff">
              <div className="conflict-block__side conflict-block__side--ours">
                <div className="conflict-block__label">当前 (Ours)</div>
                <pre>{block.ours}</pre>
              </div>
              <div className="conflict-block__side conflict-block__side--theirs">
                <div className="conflict-block__label">传入 (Theirs)</div>
                <pre>{block.theirs}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 结果预览 */}
      <div className="merge-editor__result">
        <div className="merge-editor__result-label">解决结果 (可编辑)</div>
        <div className="merge-editor__result-editor">
          <Editor
            value={resolved}
            language={getLanguage(fileName)}
            onMount={handleMount}
            onChange={(v) => v !== undefined && setResolved(v)}
            options={getEditorOptions({ readOnly: false, fontSize: 13, minimap: { enabled: false } })}
          />
        </div>
      </div>
    </div>
  );
}
