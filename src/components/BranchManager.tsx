import { useEffect, useState } from "react";
import { useGitStore, type GitBranch } from "../stores/gitStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { ChevronDown, ChevronRight } from "./Icons";
import { toast } from "../stores/toastStore";
import "../styles/git.css";

/**
 * 分支管理子面板: 列表/切换/创建/删除/合并
 */
export function BranchManager() {
  const {
    repoRoot,
    branch,
    branches,
    loadBranches,
    checkout,
    createBranch,
    deleteBranch,
    merge,
    rebase,
  } = useGitStore();
  const [expanded, setExpanded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCheckout, setNewCheckout] = useState(true);
  const [rebaseTarget, setRebaseTarget] = useState<GitBranch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GitBranch | null>(null);
  const [mergeTarget, setMergeTarget] = useState<GitBranch | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (expanded && repoRoot) loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, repoRoot]);

  const local = branches.filter((b) => !b.isRemote);
  const remote = branches.filter((b) => b.isRemote);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createBranch(newName.trim(), newCheckout);
      setNewName("");
      setShowNew(false);
    } catch (e) {
      toast.error(`创建分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = async (b: GitBranch) => {
    if (b.current) return;
    setBusy(true);
    try {
      // 远程分支: 创建本地跟踪分支
      if (b.isRemote) {
        const localName = b.name.replace("remotes/", "").replace("origin/", "");
        await createBranch(localName, true);
      } else {
        await checkout(b.name);
      }
    } catch (e) {
      toast.error(`切换分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteBranch(deleteTarget.name);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(`删除失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setBusy(true);
    try {
      await merge(mergeTarget.name);
      setMergeTarget(null);
    } catch (e) {
      toast.error(`合并失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRebase = async () => {
    if (!rebaseTarget) return;
    setBusy(true);
    try {
      await rebase(rebaseTarget.name);
      setRebaseTarget(null);
      toast.success(`已变基到 ${rebaseTarget.name}`);
    } catch (e) {
      toast.error(`变基失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="git-section branch-mgr">
      <div
        className="git-section__header branch-mgr__header"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="branch-mgr__chevron">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
        <span>分支</span>
        <span className="branch-mgr__count">{branches.length}</span>
        <button
          className="git-section__action"
          onClick={(e) => {
            e.stopPropagation();
            setShowNew((s) => !s);
            setExpanded(true);
          }}
          title="新建分支"
        >
          +
        </button>
      </div>

      {/* 新建分支表单 */}
      {showNew && expanded && (
        <div className="branch-new">
          <input
            className="branch-new__input"
            placeholder="分支名..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <label className="branch-new__check">
            <input
              type="checkbox"
              checked={newCheckout}
              onChange={(e) => setNewCheckout(e.target.checked)}
            />
            <span>创建后切换</span>
          </label>
          <button
            className="btn btn--primary branch-new__btn"
            disabled={!newName.trim() || busy}
            onClick={handleCreate}
          >
            创建
          </button>
        </div>
      )}

      {/* 本地分支列表 */}
      {expanded && (
        <div className="branch-list">
          <div className="branch-list__group">本地</div>
          {local.map((b) => (
            <BranchRow
              key={b.name}
              branch={b}
              busy={busy}
              onCheckout={() => handleCheckout(b)}
              onMerge={() => setMergeTarget(b)}
              onRebase={() => setRebaseTarget(b)}
              onDelete={() => setDeleteTarget(b)}
            />
          ))}

          {remote.length > 0 && (
            <>
              <div className="branch-list__group">远程</div>
              {remote.map((b) => (
                <BranchRow
                  key={b.name}
                  branch={b}
                  busy={busy}
                  onCheckout={() => handleCheckout(b)}
                  onMerge={() => setMergeTarget(b)}
                  onRebase={() => setRebaseTarget(b)}
                  onDelete={() => {}}
                />
              ))}
            </>
          )}
          {branches.length === 0 && (
            <div className="git-section__empty">加载中...</div>
          )}
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除分支"
        message={
          deleteTarget
            ? `确定要删除分支 "${deleteTarget.name}" 吗？`
            : ""
        }
        confirmLabel="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 合并确认 */}
      <ConfirmDialog
        open={mergeTarget !== null}
        title="合并分支"
        message={
          mergeTarget
            ? `确定要将 "${mergeTarget.name}" 合并到当前分支 "${branch}" 吗？`
            : ""
        }
        confirmLabel="合并"
        onConfirm={handleMerge}
        onCancel={() => setMergeTarget(null)}
      />

      {/* 变基确认 */}
      <ConfirmDialog
        open={rebaseTarget !== null}
        title="变基 (Rebase)"
        message={
          rebaseTarget
            ? `确定要将当前分支 "${branch}" 变基到 "${rebaseTarget.name}" 吗？\n这会重放当前分支的提交到目标分支之上。`
            : ""
        }
        confirmLabel="变基"
        onConfirm={handleRebase}
        onCancel={() => setRebaseTarget(null)}
      />
    </div>
  );
}

function BranchRow({
  branch,
  busy,
  onCheckout,
  onMerge,
  onRebase,
  onDelete,
}: {
  branch: GitBranch;
  busy: boolean;
  onCheckout: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onDelete: () => void;
}) {
  const name = branch.name.replace("remotes/", "");
  return (
    <div
      className={`branch-row ${branch.current ? "branch-row--current" : ""}`}
      onClick={onCheckout}
      title={branch.upstream ? `跟踪: ${branch.upstream}` : name}
    >
      <span className="branch-row__icon">⎇</span>
      <span className="branch-row__name">{name}</span>
      {branch.current && <span className="branch-row__tag">当前</span>}
      <span className="branch-row__hash">{branch.shortHash}</span>
      <div className="branch-row__actions">
        {!branch.current && !branch.isRemote && (
          <>
            <button
              className="branch-row__action"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onMerge();
              }}
              title="合并到当前分支"
            >
              ⊕
            </button>
            <button
              className="branch-row__action"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onRebase();
              }}
              title="变基到该分支"
            >
              ⟳
            </button>
          </>
        )}
        {!branch.current && (
          <button
            className="branch-row__action"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
