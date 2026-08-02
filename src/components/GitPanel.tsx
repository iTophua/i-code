import { useEffect, useState } from "react";
import { useGitStore, type GitFileChange, type FileStatus } from "../stores/gitStore";
import { useLayoutStore } from "../stores/layoutStore";
import { FileIcon } from "./FileIcon";
import { getFileIconType, getLanguage } from "../utils/language";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../stores/editorStore";
import { BranchManager } from "./BranchManager";
import { CommitHistory } from "./CommitHistory";
import { StashManager } from "./StashManager";
import { toast } from "../stores/toastStore";
import { RefreshCcw, ArrowDown, ArrowUp, RotateCw } from "lucide-react";
import "../styles/git.css";

function getLangByExt(name: string): string {
  return getLanguage(name);
}

const STATUS_LABEL: Record<FileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflict: "C",
};

const STATUS_CLASS: Record<FileStatus, string> = {
  modified: "st-modified",
  added: "st-added",
  deleted: "st-deleted",
  renamed: "st-modified",
  untracked: "st-untracked",
  conflict: "st-conflict",
};

export function GitPanel() {
  const {
    repoRoot,
    branch,
    changes,
    stagedCount,
    loading,
    refresh,
    stage,
    unstage,
    stageAll,
    commit,
    pull,
    push,
    fetch,
  } = useGitStore();
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const [commitMsg, setCommitMsg] = useState("");

  // 工作区刷新时检测 git
  useEffect(() => {
    if (workspaceRoot) refresh(workspaceRoot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  const staged = changes.filter((c) => c.stagedStatus !== null);
  const unstaged = changes.filter((c) => c.stagedStatus === null);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    try {
      await commit(commitMsg);
      setCommitMsg("");
    } catch (e) {
      toast.error(`提交失败: ${e}`);
    }
  };

  // 打开 diff 视图
  const openDiff = async (change: GitFileChange) => {
    if (!repoRoot) return;
    try {
      const [oldContent, newContent] = await invoke<[string, string]>(
        "git_diff_versions",
        {
          path: repoRoot,
          file: change.path,
          mode: change.stagedStatus ? "staged" : "worktree",
        }
      );
      useEditorStore.getState().openDiff({
        id: change.path,
        title: change.name,
        original: oldContent,
        modified: newContent,
        language: getLangByExt(change.name),
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && !repoRoot) {
    return (
      <div className="git-panel">
        <div className="git-panel__header">
          <span className="git-panel__title">源代码管理</span>
        </div>
        <div className="git-panel__empty">检测中...</div>
      </div>
    );
  }

  if (!repoRoot) {
    return (
      <div className="git-panel">
        <div className="git-panel__header">
          <span className="git-panel__title">源代码管理</span>
        </div>
        <div className="git-panel__empty">
          当前文件夹不是 Git 仓库
          <button className="git-panel__refresh" onClick={() => workspaceRoot && refresh(workspaceRoot)}>
            重新检测
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="git-panel">
      <div className="git-panel__header">
        <span className="git-panel__title">源代码管理</span>
        <div className="git-panel__actions">
          <button className="git-action-btn" onClick={() => fetch()} title="Fetch">
            <RefreshCcw size={15} strokeWidth={1.5} />
          </button>
          <button className="git-action-btn" onClick={() => pull()} title="Pull">
            <ArrowDown size={15} strokeWidth={1.5} />
          </button>
          <button className="git-action-btn" onClick={() => push()} title="Push">
            <ArrowUp size={15} strokeWidth={1.5} />
          </button>
          <button className="git-action-btn" onClick={() => workspaceRoot && refresh(workspaceRoot)} title="刷新">
            <RotateCw size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 当前分支 */}
      <div className="git-branch-bar">
        <span className="git-branch-bar__icon">⎇</span>
        <span className="git-branch-bar__name">{branch}</span>
        <span className="git-branch-bar__count">
          {changes.length} 改动
        </span>
      </div>

      {/* Commit 输入 */}
      <div className="git-commit">
        <textarea
          className="git-commit__input"
          placeholder="提交信息 (必填)"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          rows={3}
        />
        <button
          className={`btn git-commit__btn ${stagedCount > 0 && commitMsg.trim() ? "btn--primary" : "btn--secondary"}`}
          disabled={stagedCount === 0 || !commitMsg.trim()}
          onClick={handleCommit}
        >
          ✓ 提交 ({stagedCount} 已暂存)
        </button>
      </div>

      {/* 分支管理 */}
      <BranchManager />

      {/* 提交历史 */}
      <CommitHistory />

      {/* Stash 管理 */}
      <StashManager />

      {/* 暂存的改动 */}
      <div className="git-section">
        <div className="git-section__header">
          <span>暂存的改动</span>
          {staged.length > 0 && (
            <button
              className="git-section__action"
              onClick={() => unstage(staged.map((c) => c.path))}
              title="全部取消暂存"
            >
              －
            </button>
          )}
        </div>
        {staged.map((c) => (
          <ChangeRow
            key={`s-${c.path}`}
            change={c}
            stage="staged"
            onClick={() => openDiff(c)}
            onAction={() => unstage([c.path])}
          />
        ))}
        {staged.length === 0 && (
          <div className="git-section__empty">无暂存内容</div>
        )}
      </div>

      {/* 工作区改动 */}
      <div className="git-section">
        <div className="git-section__header">
          <span>改动</span>
          {unstaged.length > 0 && (
            <button
              className="git-section__action"
              onClick={() => stageAll()}
              title="全部暂存"
            >
              +
            </button>
          )}
        </div>
        {unstaged.map((c) => (
          <ChangeRow
            key={`u-${c.path}`}
            change={c}
            stage="unstaged"
            onClick={() => openDiff(c)}
            onAction={() => stage([c.path])}
          />
        ))}
        {unstaged.length === 0 && (
          <div className="git-section__empty">无改动</div>
        )}
      </div>
    </div>
  );
}

function ChangeRow({
  change,
  stage,
  onClick,
  onAction,
}: {
  change: GitFileChange;
  stage: "staged" | "unstaged";
  onClick: () => void;
  onAction: () => void;
}) {
  const iconType = getFileIconType(change.name, false);
  return (
    <div className="change-row" onClick={onClick} title={change.path}>
      <span className="change-row__icon">
        <FileIcon type={iconType} size={16} />
      </span>
      <span className="change-row__name">{change.name}</span>
      <span className="change-row__path">{change.path}</span>
      <span className={`change-row__status ${STATUS_CLASS[change.status]}`}>
        {STATUS_LABEL[change.status]}
      </span>
      <button
        className="change-row__action"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        title={stage === "staged" ? "取消暂存" : "暂存"}
      >
        {stage === "staged" ? "－" : "＋"}
      </button>
    </div>
  );
}
