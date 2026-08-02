import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

/**
 * 便签 → 文件导出
 */

/** 语言 → 默认扩展名 */
const LANG_EXT: Record<string, string> = {
  markdown: "md",
  javascript: "js",
  typescript: "ts",
  json: "json",
  sql: "sql",
  python: "py",
  go: "go",
  rust: "rs",
  shell: "sh",
  html: "html",
  css: "css",
  plaintext: "txt",
};

/**
 * 另存为: 弹系统对话框, 把内容写到文件
 * @returns 成功保存的路径, 取消返回 null
 */
export async function saveAsFile(
  defaultName: string,
  language: string,
  content: string
): Promise<string | null> {
  const ext = LANG_EXT[language] || "txt";
  // 去掉标题里的非法文件名字符
  const safeName = defaultName.replace(/[/\\:*?"<>|]/g, "").trim() || "untitled";

  const filePath = await save({
    title: "另存为",
    defaultPath: `${safeName}.${ext}`,
    filters: [
      { name: ext.toUpperCase(), extensions: [ext] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });

  if (!filePath) return null;

  await invoke("write_file", { filePath, content });
  return filePath;
}
