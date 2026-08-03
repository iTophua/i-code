import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  GitBranch as GitBranchIcon,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Upload,
  Plus,
  Check,
  GitMerge,
  GitPullRequest,
  Trash2,
  PenLine,
  GitCompareArrows,
  LogOut,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useGitStore, type GitBranch } from "../stores/gitStore";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { BranchDialog } from "./BranchDialog";
import { BranchCompareDialog } from "./BranchCompareDialog";
import { toast } from "../stores/toastStore";
import { invoke } from "@tauri-apps/api/core";
import "./ui/radix-theme.css";

/**
 * 标题栏分支切换器(对标 IDEA 分支面板)
 *
 * 布局(从上到下):
 *  1. 搜索框(顶部)
 *  2. 分组(可折叠):最近分支(默认展开) / 本地分支(默认收起) / 远程分支(默认收起)
 *  3. 底部操作栏:新建分支 / 更新项目(pull) / 拉取(fetch)
 *
 * 交互:
 *  - 点击分支行 → 展开/收起内联操作菜单(手风琴, 同时只开一个)
 *  - 操作:检出 / 从此分支新建 / 与当前比较 / 合并 / 变基 / 重命名(本地) / 删除
 *  - 当前分支:加粗 + 绿勾, 不显示操作
 */
export function BranchSwitcher() {
  const {
    branches, recentBranches, loadBranches, loadRecentBranches,
    checkout, createBranch, createBranchFrom, renameBranch, deleteBranch,
    merge, rebase, fetch: gitFetch, pull: gitPull,
  } = useGitStore();
  const rootPath = useFileTreeStore((s) => s.rootPath);
  const [currentBranch, setCurrentBranch] = useState("");
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  // 分组折叠状态(true=收起):最近展开, 本地/远程收起
  const [collapsed, setCollapsed] = useState({ recent: false, local: true, remote: true });
  const wrapRef = useRef<HTMLDivElement>(null);

  // 确认弹窗(合并/变基/删除)
  const [mergeTarget, setMergeTarget] = useState<GitBranch | null>(null);
  const [rebaseTarget, setRebaseTarget] = useState<GitBranch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GitBranch | null>(null);
  // 对话框(新建/从...新建/重命名)
  const [newDialog, setNewDialog] = useState(false);
  const [createFromDialog, setCreateFromDialog] = useState<GitBranch | null>(null);
  const [renameDialog, setRenameDialog] = useState<GitBranch | null>(null);
  // 比较对话框
  const [compareTarget, setCompareTarget] = useState<GitBranch | null>(null);

  // rootPath 变化时获取当前分支 + 仓库根
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

  // 打开时加载分支列表 + 最近分支
  useEffect(() => {
    if (open && repoRoot) {
      loadBranches();
      loadRecentBranches();
    }
  }, [open, repoRoot, loadBranches, loadRecentBranches]);

  // 点击 popover 外部关闭:用全屏 backdrop(不用 document 监听,避免和 Radix 事件冲突)
  // popover 内部点击(包括分支行、子菜单触发)都不会关闭;
  // 只有点 backdrop(poopver 外部)才关闭。

  // 搜索过滤
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, search]);

  // 分组数据
  const currentEntry = filtered.find((b) => b.name === currentBranch || b.name === currentBranch.replace(/^origin\//, ""));
  const localList = filtered.filter((b) => !b.isRemote && b.name !== currentBranch);
  const remoteList = filtered.filter((b) => b.isRemote);
  // 最近分支:取 recentBranches 与现有本地分支的交集(排除当前)
  const recentSet = new Set(recentBranches);
  const recentList = localList.filter((b) => recentSet.has(b.name));

  // --- 操作 handlers ---
  const handleCheckout = useCallback(async (b: GitBranch) => {
    if (busy) return;
    setBusy(true);
    try {
      if (b.isRemote) {
        // 远程分支:从该远程分支创建本地跟踪分支(而非从 HEAD)
        const localName = b.name.replace("remotes/", "").replace("origin/", "");
        await createBranchFrom(localName, b.name, true);
      } else {
        await checkout(b.name);
      }
      await useFileTreeStore.getState().refreshTree();
      const nb = await invoke<string>("git_current_branch", { path: repoRoot! });
      setCurrentBranch(nb);
      setOpen(false);
    } catch (e) {
      toast.error(`切换分支失败: ${e}`);
    } finally {
      setBusy(false);
    }
  }, [busy, checkout, createBranchFrom, repoRoot]);

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setBusy(true);
    try {
      await merge(mergeTarget.name);
      await useFileTreeStore.getState().refreshTree();
      toast.success(`已合并 ${mergeTarget.name} → ${currentBranch}`);
      setMergeTarget(null);
      setOpen(false);
    } catch (e) { toast.error(`合并失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleRebase = async () => {
    if (!rebaseTarget) return;
    setBusy(true);
    try {
      await rebase(rebaseTarget.name);
      await useFileTreeStore.getState().refreshTree();
      toast.success(`已变基到 ${rebaseTarget.name}`);
      setRebaseTarget(null);
      setOpen(false);
    } catch (e) { toast.error(`变基失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteBranch(deleteTarget.name);
      await loadBranches();
      toast.success(`已删除 ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (e) { toast.error(`删除失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleCreateNew = async (name: string, doCheckout: boolean) => {
    setBusy(true);
    try {
      await createBranch(name, doCheckout);
      await useFileTreeStore.getState().refreshTree();
      setCurrentBranch(doCheckout ? name : currentBranch);
      setNewDialog(false);
      setOpen(false);
    } catch (e) { toast.error(`新建分支失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleCreateFrom = async (name: string, doCheckout: boolean) => {
    if (!createFromDialog) return;
    setBusy(true);
    try {
      await createBranchFrom(name, createFromDialog.name, doCheckout);
      await useFileTreeStore.getState().refreshTree();
      if (doCheckout) setCurrentBranch(name);
      setCreateFromDialog(null);
      setOpen(false);
    } catch (e) { toast.error(`新建分支失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleRename = async (newName: string) => {
    if (!renameDialog) return;
    setBusy(true);
    try {
      await renameBranch(renameDialog.name, newName);
      await loadBranches();
      if (renameDialog.name === currentBranch) setCurrentBranch(newName);
      setRenameDialog(null);
    } catch (e) { toast.error(`重命名失败: ${e}`); }
    finally { setBusy(false); }
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      await gitFetch();
      await loadBranches();
      await loadRecentBranches();
      toast.success("已拉取远程更新");
    } catch (e) { toast.error(`拉取失败: ${e}`); }
    finally { setFetching(false); }
  };

  const handlePull = async () => {
    setFetching(true);
    try {
      await gitPull();
      await useFileTreeStore.getState().refreshTree();
      await loadBranches();
      toast.success("已更新当前分支");
    } catch (e) { toast.error(`更新失败: ${e}`); }
    finally { setFetching(false); }
  };

  if (!repoRoot || !currentBranch) return null;

  // 切换折叠
  const toggleCollapse = (key: "recent" | "local" | "remote") =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // 渲染分支项:整行作为 DropdownMenu 触发器, 单击弹出右侧操作菜单
  const renderBranch = (b: GitBranch) => {
    const isCurrent = b.name === currentBranch;
    return (
      <DropdownMenu.Root key={b.name}>
        <DropdownMenu.Trigger asChild>
          <div
            className={`bs-branch__row ${isCurrent ? "bs-branch__row--current" : ""}`}
            title={b.name}
          >
            <span className="bs-branch__check">
              {isCurrent && <Check size={13} strokeWidth={2.5} />}
            </span>
            <span className={`bs-branch__name ${isCurrent ? "bs-branch__name--current" : ""} ${b.isRemote ? "bs-branch__name--remote" : ""}`}>
              {b.name}
            </span>
            <span className="bs-branch__hash">{b.shortHash}</span>
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="radix-menu-content" side="right" sideOffset={8} align="start">
            <DropdownMenu.Item className="radix-menu-item" onSelect={() => handleCheckout(b)} disabled={isCurrent || busy}>
              <span className="radix-menu-item__icon"><LogOut size={13} /></span>
              <span>检出</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="radix-menu-item" onSelect={() => setCreateFromDialog(b)}>
              <span className="radix-menu-item__icon"><Plus size={13} /></span>
              <span>从此分支新建...</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="radix-menu-item" onSelect={() => setCompareTarget(b)} disabled={isCurrent}>
              <span className="radix-menu-item__icon"><GitCompareArrows size={13} /></span>
              <span>与当前分支比较</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="radix-menu-sep" />
            <DropdownMenu.Item className="radix-menu-item" onSelect={() => setMergeTarget(b)} disabled={isCurrent}>
              <span className="radix-menu-item__icon"><GitMerge size={13} /></span>
              <span>合并到 {currentBranch}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="radix-menu-item" onSelect={() => setRebaseTarget(b)} disabled={isCurrent}>
              <span className="radix-menu-item__icon"><GitPullRequest size={13} /></span>
              <span>变基到该分支</span>
            </DropdownMenu.Item>
            {!b.isRemote && (
              <>
                <DropdownMenu.Separator className="radix-menu-sep" />
                <DropdownMenu.Item className="radix-menu-item" onSelect={() => setRenameDialog(b)}>
                  <span className="radix-menu-item__icon"><PenLine size={13} /></span>
                  <span>重命名</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="radix-menu-item radix-menu-item--danger" onSelect={() => setDeleteTarget(b)} disabled={isCurrent}>
                  <span className="radix-menu-item__icon"><Trash2 size={13} /></span>
                  <span>删除分支</span>
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  };

  // 渲染分组(可折叠)
  const renderSection = (
    key: "recent" | "local" | "remote",
    title: string,
    list: GitBranch[]
  ) => {
    if (list.length === 0 && search.trim()) return null; // 搜索时空组隐藏
    return (
      <div className="bs-section">
        <div className="bs-section__header" onClick={() => toggleCollapse(key)}>
          {collapsed[key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="bs-section__title">{title}</span>
          <span className="bs-section__count">{list.length}</span>
        </div>
        {!collapsed[key] && list.length > 0 && (
          <div className="bs-section__list">
            {list.map(renderBranch)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="branch-switcher" ref={wrapRef}>
      {/* 触发按钮 */}
      <button
        className="branch-switcher__trigger"
        onClick={() => setOpen((v) => !v)}
        title="切换分支"
      >
        <GitBranchIcon size={12} strokeWidth={1.75} />
        <span className="branch-switcher__name">{currentBranch}</span>
        <ChevronDown size={11} strokeWidth={1.75} className="branch-switcher__caret" />
      </button>

      {/* 弹出面板 */}
      {open && (
        <>
        {/* backdrop:点击 popover 外部关闭(不用 document 监听, 避免和 Radix 冲突) */}
        <div className="bs-backdrop" onClick={() => setOpen(false)} />
        <div className="bs-popover">
          {/* 1. 搜索框(顶部) */}
          <div className="bs-search">
            <Search size={12} strokeWidth={1.75} />
            <input
              placeholder="搜索分支..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* 2. 分支列表 */}
          <div className="bs-list">
            {/* 当前分支置顶(在所有分组外) */}
            {currentEntry && (
              <div className="bs-current">
                <span className="bs-branch__check"><Check size={13} strokeWidth={2.5} /></span>
                <span className="bs-branch__name bs-branch__name--current">{currentBranch}</span>
                <span className="bs-branch__hash">{currentEntry.shortHash}</span>
              </div>
            )}
            {renderSection("recent", "最近分支", recentList)}
            {renderSection("local", "本地分支", localList)}
            {renderSection("remote", "远程分支", remoteList)}
            {filtered.length === 0 && (
              <div className="bs-empty">无匹配分支</div>
            )}
          </div>

          {/* 3. 底部操作栏 */}
          <div className="bs-toolbar">
            <button className="bs-toolbar__btn" onClick={() => setNewDialog(true)} title="新建分支">
              <Plus size={13} /> <span>新建</span>
            </button>
            <button className="bs-toolbar__btn" onClick={handlePull} disabled={fetching} title="更新项目 (pull)">
              <Download size={13} /> <span>更新</span>
            </button>
            <button className="bs-toolbar__btn" onClick={handleFetch} disabled={fetching} title="拉取 (fetch)">
              <Upload size={13} /> <span>拉取</span>
            </button>
          </div>
        </div>
        </>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog open={mergeTarget !== null} title="合并分支"
        message={mergeTarget ? `确定要将 "${mergeTarget.name}" 合并到当前分支 "${currentBranch}" 吗？` : ""}
        confirmLabel="合并" onConfirm={handleMerge} onCancel={() => setMergeTarget(null)} />
      <ConfirmDialog open={rebaseTarget !== null} title="变基 (Rebase)"
        message={rebaseTarget ? `确定要将当前分支 "${currentBranch}" 变基到 "${rebaseTarget.name}" 吗？` : ""}
        confirmLabel="变基" onConfirm={handleRebase} onCancel={() => setRebaseTarget(null)} />
      <ConfirmDialog open={deleteTarget !== null} title="删除分支" danger
        message={deleteTarget ? `确定要删除分支 "${deleteTarget.name}" 吗？` : ""}
        confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* 对话框 */}
      <BranchDialog open={newDialog} title="新建分支" showCheckoutOption
        onConfirm={handleCreateNew} onCancel={() => setNewDialog(false)} />
      <BranchDialog open={createFromDialog !== null} title="从此分支新建"
        hint={createFromDialog ? `从 ${createFromDialog.name} 创建` : ""} showCheckoutOption
        confirmLabel="创建"
        onConfirm={handleCreateFrom} onCancel={() => setCreateFromDialog(null)} />
      <BranchDialog open={renameDialog !== null} title="重命名分支"
        hint={renameDialog ? `重命名 ${renameDialog.name}` : ""}
        initialValue={renameDialog?.name ?? ""} confirmLabel="重命名"
        onConfirm={(name) => handleRename(name)} onCancel={() => setRenameDialog(null)} />

      {/* 比较对话框 */}
      <BranchCompareDialog open={compareTarget !== null}
        base={currentBranch} target={compareTarget?.name ?? ""}
        onClose={() => setCompareTarget(null)} />
    </div>
  );
}
