import { useEffect, useState } from "react";
import { useGitStore } from "../stores/gitStore";
import { getLanguage } from "../utils/language";
import { useEditorStore } from "../stores/editorStore";
import { toast } from "../stores/toastStore";

interface HistoryEntry {
  hash: string;
  shortHash: string;
  author: string;
  timestamp: number;
  subject: string;
}

/**
 * 文件历史视图(在编辑区 Tab 打开)
 * 显示某文件的所有 commit, 点击对比版本
 */
export function FileHistoryView({ filePath, fileName }: { filePath: string; fileName: string }) {
  const { repoRoot, fileHistory, showFileVersion } = useGitStore();
  const openDiff = useEditorStore((s) => s.openDiff);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoRoot) return;
    const relPath = filePath.startsWith(repoRoot)
      ? filePath.slice(repoRoot.length + 1)
      : filePath;
    fileHistory(relPath)
      .then((out) => {
        const list = out
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => {
            const [hash, shortHash, author, ts, ...subjectParts] = line.split("|");
            return {
              hash,
              shortHash,
              author,
              timestamp: parseInt(ts) || 0,
              subject: subjectParts.join("|"),
            };
          });
        setEntries(list);
        setLoading(false);
      })
      .catch((e) => {
        toast.error(`加载文件历史失败: ${e}`);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // 对比两个版本
  const compareWithCurrent = async (entry: HistoryEntry) => {
    if (!repoRoot) return;
    const relPath = filePath.startsWith(repoRoot)
      ? filePath.slice(repoRoot.length + 1)
      : filePath;
    try {
      const oldContent = await showFileVersion(entry.hash, relPath);
      // 读取当前工作区版本
      const { invoke } = await import("@tauri-apps/api/core");
      const [newContent] = await invoke<[string, string]>("read_file", { filePath });
      openDiff({
        id: `history-${relPath}-${entry.shortHash}`,
        title: `${fileName} @${entry.shortHash} ↔ 当前`,
        original: oldContent,
        modified: newContent,
        language: getLanguage(fileName),
      });
    } catch (e) {
      toast.error(`对比失败: ${e}`);
    }
  };

  return (
    <div className="file-history-view">
      <div className="file-history-view__header">
        <span className="file-history-view__title">📋 {fileName} 的历史</span>
        <span className="file-history-view__count">{entries.length} 个提交</span>
      </div>
      <div className="file-history-view__list">
        {loading ? (
          <div className="git-section__empty">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="git-section__empty">无历史记录</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.hash}
              className="commit-row"
              onClick={() => compareWithCurrent(entry)}
              title={`点击对比 ${entry.shortHash} 与当前版本`}
            >
              <div className="commit-row__main">
                <span className="commit-row__hash">{entry.shortHash}</span>
                <span className="commit-row__subject">{entry.subject}</span>
              </div>
              <div className="commit-row__meta">
                <span className="commit-row__author">{entry.author}</span>
                <span className="commit-row__time">{formatTime(entry.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
