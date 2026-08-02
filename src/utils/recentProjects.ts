import { getSession, setSession } from "../utils/session";

/**
 * 最近项目列表
 */

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
}

const KEY = "recentProjects";
const MAX = 10;

/** 添加到最近项目 */
export async function addRecentProject(path: string): Promise<void> {
  const list = await getRecentProjects();
  const filtered = list.filter((p) => p.path !== path);
  const name = path.split("/").pop() || path;
  filtered.unshift({ path, name, openedAt: Date.now() });
  await setSession(KEY, filtered.slice(0, MAX));
}

/** 获取最近项目 */
export async function getRecentProjects(): Promise<RecentProject[]> {
  return (await getSession<RecentProject[]>(KEY)) || [];
}

/** 移除一个最近项目 */
export async function removeRecentProject(path: string): Promise<RecentProject[]> {
  const list = await getRecentProjects();
  const filtered = list.filter((p) => p.path !== path);
  await setSession(KEY, filtered);
  return filtered;
}
