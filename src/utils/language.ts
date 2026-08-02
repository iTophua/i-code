/**
 * 文件扩展名 → Monaco 语言 id 映射
 */

const EXT_LANG_MAP: Record<string, string> = {
  // Web 前端
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  vue: "html",

  // 后端
  go: "go",
  rs: "rust",
  py: "python",
  java: "java",
  kt: "kotlin",
  rb: "ruby",
  php: "php",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",

  // 数据/脚本
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  bat: "bat",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  csv: "csv",

  // 文档
  md: "markdown",
  markdown: "markdown",
  txt: "plaintext",

  // 其他
  dockerfile: "dockerfile",
  graphql: "graphql",
  proto: "proto",
};

const FILENAME_LANG_MAP: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  ".gitignore": "ignore",
  ".dockerignore": "ignore",
  ".npmrc": "ini",
  ".env": "ini",
};

/** 根据文件名/扩展名获取语言 id */
export function getLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (FILENAME_LANG_MAP[lower]) return FILENAME_LANG_MAP[lower];
  const ext = lower.includes(".")
    ? lower.slice(lower.lastIndexOf(".") + 1)
    : "";
  return EXT_LANG_MAP[ext] || "plaintext";
}

/**
 * 语言 id → 文件扩展名映射(反向)
 * 用于给便签等无真实文件的 Monaco 模型构造合成 path,
 * 以便语言服务(worker)能按扩展名正确挂载(补全/校验/hover)
 */
const LANG_EXT_MAP: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  markdown: "md",
  sql: "sql",
  python: "py",
  go: "go",
  rust: "rs",
  shell: "sh",
  yaml: "yaml",
  xml: "xml",
  ini: "ini",
  java: "java",
  kotlin: "kt",
  ruby: "rb",
  php: "php",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  swift: "swift",
  graphql: "graphql",
  proto: "proto",
  dockerfile: "dockerfile",
};

/** 根据语言 id 取一个文件扩展名(无映射时回退到 txt) */
export function getExtByLanguage(langId: string): string {
  return LANG_EXT_MAP[langId] || "txt";
}

/** 简易文件类型(用于图标选择) */
export type FileIconType =
  | "ts"
  | "js"
  | "jsx"
  | "tsx"
  | "vue"
  | "json"
  | "css"
  | "scss"
  | "html"
  | "md"
  | "go"
  | "rust"
  | "python"
  | "java"
  | "csharp"
  | "cpp"
  | "c"
  | "php"
  | "ruby"
  | "swift"
  | "kotlin"
  | "sql"
  | "shell"
  | "yaml"
  | "docker"
  | "git"
  | "lock"
  | "config"
  | "image"
  | "folder"
  | "file";

export function getFileIconType(filename: string, isFolder: boolean): FileIconType {
  if (isFolder) return "folder";
  const lower = filename.toLowerCase();

  // 特殊文件名优先匹配
  if (lower === "dockerfile") return "docker";
  if (lower === ".gitignore" || lower === ".gitattributes") return "git";
  if (lower.endsWith(".lock") || lower === "package-lock.json" || lower === "yarn.lock" || lower === "pnpm-lock.yaml")
    return "lock";
  if (lower === "package.json" || lower === "tsconfig.json") return "json";
  if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(lower)) return "image";

  // 扩展名匹配
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  const extMap: Record<string, FileIconType> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    jsx: "jsx",
    mjs: "js",
    cjs: "js",
    vue: "vue",
    json: "json",
    jsonc: "json",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "scss",
    html: "html",
    htm: "html",
    md: "md",
    markdown: "md",
    go: "go",
    rs: "rust",
    py: "python",
    java: "java",
    cs: "csharp",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "cpp",
    hpp: "cpp",
    c: "c",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yaml: "yaml",
    yml: "yaml",
  };
  if (extMap[ext]) return extMap[ext];

  const lang = getLanguage(filename);
  const map: Record<string, FileIconType> = {
    typescript: "ts",
    javascript: "js",
    json: "json",
    css: "css",
    scss: "scss",
    less: "scss",
    html: "html",
    markdown: "md",
    go: "go",
    rust: "rust",
    python: "python",
    java: "java",
    ini: "config",
    toml: "config",
    xml: "config",
    csv: "config",
    dockerfile: "docker",
    ignore: "git",
    bat: "shell",
    powershell: "shell",
    makefile: "config",
  };
  return map[lang] || "file";
}
