import { useState, useRef, useEffect } from "react";
import { GitBranch as GitBranchIcon, Check, Plus, ChevronDown } from "lucide-react";
import { useGitStore, type GitBranch } from "../stores/gitStore";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { toast } from "../stores/toastStore";
import { invoke } from "@tauri-apps/api/core";

/**
 * 文件树分支切换器: 项目名右侧显示当前分支, 点击弹出分支列表。
 * - 本地分支 + 远程分支分组
 * - 新建分支输入框
 * - checkout 后刷新文件树
 *
 * 当前分支名自己直接调 git_current_branch 获取(不依赖 gitStore 异步初始化),
 * 分支列表/切换操作复用 gitStore。
 */
export function BranchSwitcher() {
  const { branches, loadBranches, checkout, createBranch } = useGitStore();
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const [currentBranch, setCurrentBranch] = useState("");
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const local = branches.filter((b) => !b.isRemote);
  const remote = branches.filter((b) => b.isRemote);

  // rootPath 变化时, 直接获取当前分支 + 仓库根(不依赖 gitStore 初始化时序)
  useEffect(() => {
    if (!rootPath) {
      setCurrentBranch("");
      setRepoRoot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const root = await invoke<string>("git_repo_root", { path: rootPath });
        const branch = await invoke<string>("git_current_branch", { path: root });
        if (!cancelled) {
          setRepoRoot(root);
          setCurrentBranch(branch);
        }
      } catch {
        if (!cancelled) {
          setRepoRoot(null);
          setCurrentBranch("");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [rootPath]);

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
      // 切换后: 刷新文件树 + 更新本地当前分支
      await useFileTreeStore.getState().refreshTree();
      const newBranch = await invoke<string>("git_current_branch", { path: repoRoot! });
      setCurrentBranch(newBranch);
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
      setCurrentBranch(name);
      setNewName("");
      setShowNew(false);
      setOpen(false);
    } catch (e) {
      toast.error(`新建分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!repoRoot || !currentBranch) return null;

  const renderBranch = (b: GitBranch) => {
    const display = b.name.replace("remotes/", "");
    // 用本地 currentBranch 判断当前(比 gitStore 解析的 b.current 更可靠)
    const isCurrent = display === currentBranch || b.name === currentBranch;
    return (
      <button
        key={b.name}
        className={`branch-switcher__item ${isCurrent ? "branch-switcher__item--current" : ""}`}
        disabled={busy || isCurrent}
        onClick={() => handleCheckout(b)}
        title={b.upstream ? `${display} ← ${b.upstream}` : display}
      >
        <span className="branch-switcher__check">
          {isCurrent && <Check size={13} strokeWidth={2} />}
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
        <span className="branch-switcher__name">{currentBranch}</span>
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
