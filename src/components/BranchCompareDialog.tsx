import { useEffect, useState } from "react";
import { useGitStore, type GitLogEntry } from "../stores/gitStore";

/**
 * 分支比较对话框:显示 target 相对 base 的差异 commit 列表
 * 对标 IDEA "Compare with Current"
 */
interface Props {
  open: boolean;
  /** 基准分支(通常是当前分支) */
  base: string;
  /** 目标分支 */
  target: string;
  onClose: () => void;
}

export function BranchCompareDialog({ open, base, target, onClose }: Props) {
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !base || !target) return;
    setLoading(true);
    setCommits([]);
    useGitStore.getState()
      .compareBranches(base, target)
      .then((list) => {
        setCommits(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, base, target]);

  if (!open) return null;

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="branch-compare" onClick={(e) => e.stopPropagation()}>
        <div className="branch-compare__header">
          <span className="branch-compare__title">
            比较: {base} <span className="branch-compare__arrow">..</span> {target}
          </span>
          <span className="branch-compare__count">{commits.length} 个提交</span>
          <button className="branch-compare__close" onClick={onClose} title="关闭">✕</button>
        </div>
        <div className="branch-compare__list">
          {loading ? (
            <div className="branch-compare__empty">加载中...</div>
          ) : commits.length === 0 ? (
            <div className="branch-compare__empty">无差异提交</div>
          ) : (
            commits.map((c) => (
              <div key={c.hash} className="branch-compare__row" title={c.subject}>
                <span className="branch-compare__hash">{c.shortHash}</span>
                <span className="branch-compare__subject">{c.subject}</span>
                <span className="branch-compare__author">{c.author}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
