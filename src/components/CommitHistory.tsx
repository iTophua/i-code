import { useEffect, useState } from "react";
import { useGitStore, type GitLogEntry } from "../stores/gitStore";
import { ChevronDown, ChevronRight } from "./Icons";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "../stores/toastStore";
import "../styles/git.css";

/**
 * 提交历史日志视图(可折叠区域)
 */
export function CommitHistory() {
  const { repoRoot, log, loadLog } = useGitStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && repoRoot) loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, repoRoot]);

  return (
    <div className="git-section history-mgr">
      <div
        className="git-section__header history-mgr__header"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="branch-mgr__chevron">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
        <span>提交历史</span>
        <span className="branch-mgr__count">{log.length || ""}</span>
      </div>

      {expanded && (
        <div className="history-list">
          {log.length === 0 ? (
            <div className="git-section__empty">加载中...</div>
          ) : (
            log.map((entry) => (
              <CommitRow key={entry.hash} entry={entry} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CommitRow({ entry }: { entry: GitLogEntry }) {
  const cherryPick = useGitStore((s) => s.cherryPick);
  const [confirmCP, setConfirmCP] = useState(false);

  const handleCherryPick = async () => {
    try {
      await cherryPick(entry.hash);
      setConfirmCP(false);
      toast.success(`已摘取 ${entry.shortHash}`);
    } catch (e) {
      toast.error(`摘取失败: ${e}`);
    }
  };

  return (
    <div className="commit-row" title={entry.hash}>
      <div className="commit-row__main">
        <span className="commit-row__hash">{entry.shortHash}</span>
        <span className="commit-row__subject">{entry.subject}</span>
        {/* cherry-pick 操作 */}
        <button
          className="commit-row__action"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmCP(true);
          }}
          title="摘取此提交 (cherry-pick)"
        >
          🍒
        </button>
      </div>
      <div className="commit-row__meta">
        <span className="commit-row__author">{entry.author}</span>
        <span className="commit-row__time">{formatTime(entry.timestamp)}</span>
      </div>
      {entry.refs && (
        <div className="commit-row__refs">
          {entry.refs
            .split(",")
            .filter((r) => r.trim())
            .map((r, i) => (
              <span key={i} className="commit-row__ref">{r.trim()}</span>
            ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmCP}
        title="摘取提交 (Cherry-pick)"
        message={`确定要将提交 "${entry.shortHash} ${entry.subject}" 摘取到当前分支吗？`}
        confirmLabel="摘取"
        onConfirm={handleCherryPick}
        onCancel={() => setConfirmCP(false)}
      />
    </div>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
