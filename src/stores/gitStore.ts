import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/**
 * Git 状态管理
 * 解析 porcelain v2 status, 提供操作命令
 */

/** 文件状态码 */
export type FileStatus =
  | "modified" // 修改
  | "added" // 新增(已跟踪)
  | "deleted" // 删除
  | "renamed" // 重命名
  | "untracked" // 未跟踪
  | "conflict"; // 冲突

/** 单个改动文件 */
export interface GitFileChange {
  /** 仓库相对路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 暂存状态 */
  stagedStatus: FileStatus | null;
  /** 工作区状态 */
  worktreeStatus: FileStatus | null;
  /** 综合状态(用于图标显示) */
  status: FileStatus;
}

/** commit 历史条目 */
export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  timestamp: number;
  subject: string;
  refs: string;
  graph: string;
}

/** 分支 */
export interface GitBranch {
  current: boolean;
  name: string;
  shortHash: string;
  upstream: string;
  isRemote: boolean;
}

interface GitStore {
  /** 仓库根目录(无 = 不是 git 仓库) */
  repoRoot: string | null;
  /** 当前分支 */
  branch: string;
  /** 改动文件 */
  changes: GitFileChange[];
  /** 暂存的文件数 */
  stagedCount: number;
  /** 是否在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 初始化/刷新(检测仓库 + 状态) */
  refresh: (workspaceRoot: string) => Promise<void>;
  /** 暂存文件 */
  stage: (files: string[]) => Promise<void>;
  /** 取消暂存 */
  unstage: (files: string[]) => Promise<void>;
  /** 全部暂存 */
  stageAll: () => Promise<void>;
  /** 提交 */
  commit: (message: string) => Promise<void>;

  // 远程
  pull: () => Promise<void>;
  push: (setUpstream?: boolean) => Promise<void>;
  fetch: () => Promise<void>;

  // 分支
  branches: GitBranch[];
  /** 最近 checkout 过的分支名(从 reflog 解析) */
  recentBranches: string[];
  log: GitLogEntry[];
  loadBranches: () => Promise<void>;
  loadRecentBranches: () => Promise<void>;
  loadLog: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  createBranch: (name: string, checkout?: boolean) => Promise<void>;
  /** 从指定 source 分支创建新分支(对标 IDEA New Branch from) */
  createBranchFrom: (name: string, source: string, checkout?: boolean) => Promise<void>;
  /** 重命名本地分支 */
  renameBranch: (oldName: string, newName: string) => Promise<void>;
  /** 比较两个分支的差异 commit 列表 */
  compareBranches: (base: string, target: string) => Promise<GitLogEntry[]>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  merge: (branch: string) => Promise<void>;
  rebase: (branch: string) => Promise<void>;
  rebaseContinue: () => Promise<void>;
  rebaseAbort: () => Promise<void>;
  mergeAbort: () => Promise<void>;
  cherryPick: (hash: string) => Promise<void>;
  cherryPickAbort: () => Promise<void>;
  inProgress: () => Promise<string>;

  // stash
  stashes: string[];
  loadStashes: () => Promise<void>;
  stashPush: (message?: string) => Promise<void>;
  stashPop: (index: number) => Promise<void>;

  // blame + 文件历史(返回原始输出, 组件解析)
  blameFile: (file: string) => Promise<string>;
  fileHistory: (file: string) => Promise<string>;
  showFileVersion: (refName: string, file: string) => Promise<string>;
  /** 比较当前文件与指定分支版本, 打开 diff 视图 */
  compareFileWithBranch: (filePath: string, branch: string) => Promise<void>;
}

/** 解析 porcelain v2 status */
function parseStatus(
  output: string
): { branch: string; changes: GitFileChange[] } {
  const changes: GitFileChange[] = [];
  let branch = "";

  // porcelain v2 -z 用 \0 分隔, 这里 stdout 已是字符串
  // 但 -z 模式行内无换行, 需按 \0 拆; 实际 from_utf8 后 \0 仍在
  const lines = output.split("\n").filter((l) => l.length > 0);

  for (const line of lines) {
    // 分支头: # branch.head main
    if (line.startsWith("# branch.head")) {
      branch = line.split(" ").slice(2).join(" ").trim();
      continue;
    }
    // 普通文件: 1 <xy> <sub> <mH> <mI> <mW> <hH> <path>
    // 或未跟踪: ? <path>
    // 或重命名: 2 <xy> <sub> <mH> <mI> <mW> <hH> <X><score> <path><sep><origPath>

    if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const parts = line.split("\t");
      const metaPart = parts[0].split(" ");
      const xy = metaPart[1]; // 如 "M " / " M" / "A " / "D " / "MM"
      const filePath = parts[1] || "";
      const stagedChar = xy[0];
      const worktreeChar = xy[1];

      changes.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        stagedStatus: charToStatus(stagedChar),
        worktreeStatus: charToStatus(worktreeChar),
        status: worktreeChar !== " "
          ? charToStatus(worktreeChar)!
          : charToStatus(stagedChar)!,
      });
    } else if (line.startsWith("? ")) {
      // 未跟踪文件
      const filePath = line.slice(2).trim();
      changes.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        stagedStatus: null,
        worktreeStatus: "untracked",
        status: "untracked",
      });
    } else if (line.startsWith("u ")) {
      // 冲突
      const parts = line.split("\t");
      const filePath = parts[1] || line.slice(2).trim();
      changes.push({
        path: filePath,
        name: filePath.split("/").pop() || filePath,
        stagedStatus: "conflict",
        worktreeStatus: "conflict",
        status: "conflict",
      });
    }
  }

  return { branch, changes };
}

function charToStatus(c: string): FileStatus | null {
  switch (c) {
    case "M":
      return "modified";
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "conflict";
    case " ":
      return null;
    default:
      return "modified";
  }
}

/** 解析 git log */
function parseLog(output: string): GitLogEntry[] {
  return output
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) => {
      const [hash, shortHash, author, _email, ts, subject, refs] =
        line.split("|");
      return {
        hash,
        shortHash,
        author,
        email: _email,
        timestamp: parseInt(ts) || 0,
        subject,
        refs: refs || "",
        graph: "",
      };
    });
}

/** 解析分支列表 */
function parseBranches(output: string): GitBranch[] {
  return output
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      // format: %(HEAD)|%(refname)|%(refname:short)|%(objectname:short)|%(upstream:short)
      // 用 | 分隔:HEAD 对非当前分支返回空字符串, 用空格会被 trim+split 吞掉
      const parts = line.split("|");
      const current = parts[0] === "*";
      const fullRefname = parts[1] || "";   // refs/heads/main / refs/remotes/origin/main
      const name = parts[2] || "";           // main / origin/main (short, 用于显示)
      const shortHash = parts[3] || "";
      const upstream = parts[4] || "";
      return {
        current,
        name,
        shortHash,
        upstream,
        // 用完整 refname 判断:refs/remotes/* 是远程分支
        isRemote: fullRefname.startsWith("refs/remotes/"),
      };
    })
    // 过滤 detached HEAD 条目:
    //  - name 形如 "(HEAD" / "(detached" / "(no" (括号开头,非合法分支名)
    //  - name 是纯 commit hash(7+ 位十六进制,detached 时 refname:short 返回 hash)
    .filter(
      (b) =>
        !b.name.startsWith("(") &&
        !/^[0-9a-f]{7,40}$/.test(b.name)
    );
}

export const useGitStore = create<GitStore>((set, get) => ({
  repoRoot: null,
  branch: "",
  changes: [],
  stagedCount: 0,
  loading: false,
  error: null,
  branches: [],
  recentBranches: [],
  log: [],

  refresh: async (workspaceRoot) => {
    set({ loading: true, error: null });
    try {
      // 检测仓库
      const root = await invoke<string>("git_repo_root", { path: workspaceRoot });
      if (!root) {
        set({ repoRoot: null, changes: [], loading: false });
        return;
      }
      const statusOut = await invoke<string>("git_status", { path: root });
      const { branch, changes } = parseStatus(statusOut);
      const stagedCount = changes.filter(
        (c) => c.stagedStatus !== null
      ).length;
      set({
        repoRoot: root,
        branch,
        changes,
        stagedCount,
        loading: false,
      });
    } catch (e) {
      set({ repoRoot: null, changes: [], loading: false, error: String(e) });
    }
  },

  stage: async (files) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_add", { path: repoRoot, files });
    await get().refresh(repoRoot);
  },

  unstage: async (files) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_restore_staged", { path: repoRoot, files });
    await get().refresh(repoRoot);
  },

  stageAll: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_add_all", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  commit: async (message) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_commit", { path: repoRoot, message });
    await get().refresh(repoRoot);
  },

  pull: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_pull", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  push: async (setUpstream) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_push", { path: repoRoot, setUpstream });
    await get().refresh(repoRoot);
  },

  fetch: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_fetch", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  loadBranches: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    const out = await invoke<string>("git_branches", { path: repoRoot });
    set({ branches: parseBranches(out) });
  },

  loadRecentBranches: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    try {
      const recent = await invoke<string[]>("git_recent_branches", { path: repoRoot });
      set({ recentBranches: recent });
    } catch {
      set({ recentBranches: [] });
    }
  },

  loadLog: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    const out = await invoke<string>("git_log", { path: repoRoot, limit: 100 });
    set({ log: parseLog(out) });
  },

  checkout: async (branch) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_checkout", { path: repoRoot, branch });
    await get().refresh(repoRoot);
  },

  createBranch: async (name, checkout) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    if (checkout) {
      await invoke("git_checkout_new", { path: repoRoot, name });
    } else {
      await invoke("git_create_branch", { path: repoRoot, name });
    }
    await get().refresh(repoRoot);
  },

  createBranchFrom: async (name, source, checkout) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_branch_from", { path: repoRoot, newName: name, source });
    if (checkout) {
      await invoke("git_checkout", { path: repoRoot, branch: name });
    }
    await get().refresh(repoRoot);
  },

  renameBranch: async (oldName, newName) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_branch_rename", { path: repoRoot, oldName, newName });
    await get().refresh(repoRoot);
  },

  compareBranches: async (base, target) => {
    const { repoRoot } = get();
    if (!repoRoot) return [];
    const out = await invoke<string>("git_compare_branches", {
      path: repoRoot, base, target,
    });
    return parseLog(out);
  },

  deleteBranch: async (name, force) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_delete_branch", { path: repoRoot, name, force });
    await get().refresh(repoRoot);
  },

  merge: async (branch) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_merge", { path: repoRoot, branch });
    await get().refresh(repoRoot);
  },

  rebase: async (branch) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    await invoke("git_rebase", { path: repoRoot, branch });
    await get().refresh(repoRoot);
  },

  rebaseContinue: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_rebase_continue", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  rebaseAbort: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_rebase_abort", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  mergeAbort: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_merge_abort", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  cherryPick: async (hash) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    await invoke("git_cherry_pick", { path: repoRoot, hash });
    await get().refresh(repoRoot);
  },

  cherryPickAbort: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_cherry_pick_abort", { path: repoRoot });
    await get().refresh(repoRoot);
  },

  inProgress: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return "none";
    return invoke<string>("git_in_progress", { path: repoRoot });
  },

  stashes: [],

  loadStashes: async () => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    const out = await invoke<string>("git_stash_list", { path: repoRoot });
    const list = out.split("\n").filter((l) => l.trim().length > 0);
    set({ stashes: list });
  },

  stashPush: async (message) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_stash_push", { path: repoRoot, message: message || null });
    await get().refresh(repoRoot);
    await get().loadStashes();
  },

  stashPop: async (index) => {
    const { repoRoot } = get();
    if (!repoRoot) return;
    await invoke("git_stash_pop", { path: repoRoot, index });
    await get().refresh(repoRoot);
    await get().loadStashes();
  },

  blameFile: async (file) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    return invoke<string>("git_blame", { path: repoRoot, file });
  },

  fileHistory: async (file) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    return invoke<string>("git_file_history", { path: repoRoot, file });
  },

  showFileVersion: async (refName, file) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    return invoke<string>("git_show_file", { path: repoRoot, refName, file });
  },

  compareFileWithBranch: async (filePath, branch) => {
    const { repoRoot } = get();
    if (!repoRoot) throw new Error("无仓库");
    const rel = filePath.replace(repoRoot + "/", "");
    // 取分支版本(旧) + 工作区当前内容(新)
    const original = await invoke<string>("git_show_file", {
      path: repoRoot, refName: branch, file: rel,
    }).catch(() => ""); // 分支可能没有该文件
    // 读工作区文件内容
    const { invoke: inv } = await import("@tauri-apps/api/core");
    const [modified] = await inv<[string, string]>("read_file", { filePath });
    const name = filePath.split("/").pop() || filePath;
    // 用动态 import 避免循环依赖
    const { useEditorStore } = await import("./editorStore");
    useEditorStore.getState().openDiff({
      id: `compare-${branch}-${rel}`,
      title: `${name} vs ${branch}`,
      original,
      modified,
      language: undefined,
    });
  },
}));
