import { useState, useRef, useEffect } from "react";
import { GitBranch as GitBranchIcon, Check, Plus, ChevronDown } from "lucide-react";
import { useGitStore, type GitBranch } from "../stores/gitStore";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { toast } from "../stores/toastStore";

/**
 * 文件树分支切换器: 项目名右侧显示当前分支, 点击弹出分支列表。
 * - 本地分支 + 远程分支分组
 * - 新建分支输入框
 * - checkout 后刷新文件树
 */
export function BranchSwitcher() {
  const { repoRoot, branch, branches, loadBranches, checkout, createBranch } = useGitStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const local = branches.filter((b) => !b.isRemote);
  const remote = branches.filter((b) => b.isRemote);

  // 打开时加载分支列表
  useEffect(() => {
    if (open && repoRoot) loadBranches();
  }, [open, repoRoot, loadBranches]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNew(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 切换分支(复用 BranchManager 远程分支处理逻辑)
  const handleCheckout = async (b: GitBranch) => {
    if (b.current) return;
    setBusy(true);
    try {
      if (b.isRemote) {
        const localName = b.name.replace("remotes/", "").replace("origin/", "");
        await createBranch(localName, true);
      } else {
        await checkout(b.name);
      }
      // 切换后刷新文件树
      await useFileTreeStore.getState().refreshTree();
      setOpen(false);
    } catch (e) {
      toast.error(`切换分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  // 新建分支
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createBranch(name, true);
      await useFileTreeStore.getState().refreshTree();
      setNewName("");
      setShowNew(false);
      setOpen(false);
    } catch (e) {
      toast.error(`新建分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!repoRoot || !branch) return null;

  const renderBranch = (b: GitBranch) => {
    const display = b.name.replace("remotes/", "");
    return (
      <button
        key={b.name}
        className={`branch-switcher__item ${b.current ? "branch-switcher__item--current" : ""}`}
        disabled={busy || b.current}
        onClick={() => handleCheckout(b)}
        title={b.upstream ? `${display} ← ${b.upstream}` : display}
      >
        <span className="branch-switcher__check">
          {b.current && <Check size={13} strokeWidth={2} />}
        </span>
        <span className="branch-switcher__name">{display}</span>
      </button>
    );
  };

  return (
    <div className="branch-switcher" ref={wrapRef}>
      <button
        className="branch-switcher__trigger"
        onClick={() => setOpen((v) => !v)}
        title="切换分支"
      >
        <GitBranchIcon size={12} strokeWidth={1.75} />
        <span className="branch-switcher__name">{branch}</span>
        <ChevronDown size={11} strokeWidth={1.75} className="branch-switcher__caret" />
      </button>

      {open && (
        <div className="branch-switcher__popover">
          <div className="branch-switcher__list">
            {local.length > 0 && (
              <>
                <div className="branch-switcher__group">本地</div>
                {local.map(renderBranch)}
              </>
            )}
            {remote.length > 0 && (
              <>
                <div className="branch-switcher__group">远程</div>
                {remote.map(renderBranch)}
              </>
            )}
          </div>

          <div className="branch-switcher__sep" />

          {showNew ? (
            <div className="branch-switcher__new">
              <input
                autoFocus
                className="branch-switcher__input"
                placeholder="分支名..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setShowNew(false);
                }}
              />
              <button
                className="branch-switcher__new-btn"
                onClick={handleCreate}
                disabled={busy || !newName.trim()}
              >
                创建
              </button>
            </div>
          ) : (
            <button
              className="branch-switcher__new-toggle"
              onClick={() => setShowNew(true)}
            >
              <Plus size={13} strokeWidth={1.75} />
              <span>新建分支</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
