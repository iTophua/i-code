import type { FileIconType } from "../utils/language";
import {
  SiTypescript,
  SiJavascript,
  SiJson,
  SiCss,
  SiSass,
  SiHtml5,
  SiMarkdown,
  SiGo,
  SiRust,
  SiPython,
  SiMysql,
  SiGnubash,
  SiReact,
  SiVuedotjs,
  SiCplusplus,
  SiC,
  SiPhp,
  SiRuby,
  SiSwift,
  SiKotlin,
  SiYaml,
  SiDocker,
  SiGit,
} from "react-icons/si";
import type { IconType } from "react-icons";

/**
 * 文件/文件夹图标
 * 文件: 用 react-icons 的品牌 Logo(Simple Icons), 彩色丰富
 * 文件夹: VS Code 风格活页夹
 */

const ICON_MAP: Partial<Record<FileIconType, IconType>> = {
  ts: SiTypescript,
  tsx: SiTypescript,
  js: SiJavascript,
  jsx: SiReact,
  vue: SiVuedotjs,
  json: SiJson,
  css: SiCss,
  scss: SiSass,
  html: SiHtml5,
  md: SiMarkdown,
  go: SiGo,
  rust: SiRust,
  python: SiPython,
  java: SiKotlin, // Java 用 Kotlin 图标近似(无官方 Java logo)
  csharp: SiCplusplus, // C# 用 C++ 图标近似
  cpp: SiCplusplus,
  c: SiC,
  php: SiPhp,
  ruby: SiRuby,
  swift: SiSwift,
  kotlin: SiKotlin,
  sql: SiMysql,
  shell: SiGnubash,
  yaml: SiYaml,
  docker: SiDocker,
  git: SiGit,
};

const ICON_COLORS: Record<string, string> = {
  ts: "#3178C6",
  tsx: "#3178C6",
  js: "#F0DB4F",
  jsx: "#61DAFB",
  vue: "#42B883",
  json: "#CBC24A",
  css: "#42A5F5",
  scss: "#CD6799",
  html: "#E44D26",
  md: "#42A5F5",
  go: "#00ADD8",
  rust: "#DEA584",
  python: "#3572A5",
  java: "#B07219",
  csharp: "#178600",
  cpp: "#00599C",
  c: "#555555",
  php: "#777BB4",
  ruby: "#701516",
  swift: "#FA7343",
  kotlin: "#A97BFF",
  sql: "#E38C2C",
  shell: "#89E051",
  yaml: "#CB171E",
  docker: "#2496ED",
  git: "#F05032",
  lock: "#858585",
  config: "#858585",
  image: "#A074C4",
  file: "#9AA0A6",
  folder: "#C09553",
};

/**
 * 文件夹名称 → 颜色映射(参考 VS Code Material Icon Theme)
 * 没有命中的用默认棕色
 */
const FOLDER_COLORS: Record<string, { top: string; body: string; light: string }> = {
  src: { top: "#519ABA", body: "#4A8FA8", light: "#6BB5D8" },
  source: { top: "#519ABA", body: "#4A8FA8", light: "#6BB5D8" },
  components: { top: "#E0B02E", body: "#C99520", light: "#F0C84A" },
  public: { top: "#E8A33D", body: "#D08827", light: "#F5BC60" },
  assets: { top: "#E8A33D", body: "#D08827", light: "#F5BC60" },
  static: { top: "#E8A33D", body: "#D08827", light: "#F5BC60" },
  node_modules: { top: "#5FA04E", body: "#4E8A40", light: "#7BC068" },
  docs: { top: "#42A5F5", body: "#3490D4", light: "#64BFF7" },
  doc: { top: "#42A5F5", body: "#3490D4", light: "#64BFF7" },
  config: { top: "#90A4AE", body: "#78909C", light: "#B0BEC5" },
  configs: { top: "#90A4AE", body: "#78909C", light: "#B0BEC5" },
  test: { top: "#F06292", body: "#D84A7C", light: "#F88BB0" },
  tests: { top: "#F06292", body: "#D84A7C", light: "#F88BB0" },
  __tests__: { top: "#F06292", body: "#D84A7C", light: "#F88BB0" },
  lib: { top: "#7E57C2", body: "#6E48B0", light: "#9B7DD8" },
  utils: { top: "#7E57C2", body: "#6E48B0", light: "#9B7DD8" },
  hooks: { top: "#EF5350", body: "#D84A47", light: "#F77A77" },
  dist: { top: "#78909C", body: "#607D8B", light: "#9FAFB8" },
  build: { top: "#78909C", body: "#607D8B", light: "#9FAFB8" },
  styles: { top: "#EC407A", body: "#D32F6F", light: "#F068A0" },
  css: { top: "#42A5F5", body: "#3490D4", light: "#64BFF7" },
  images: { top: "#AB47BC", body: "#94335A", light: "#C175D0" },
  img: { top: "#AB47BC", body: "#94335A", light: "#C175D0" },
  locales: { top: "#26A69A", body: "#1E8C82", light: "#4DBCB2" },
  i18n: { top: "#26A69A", body: "#1E8C82", light: "#4DBCB2" },
  api: { top: "#66BB6A", body: "#52A85A", light: "#85CF88" },
  server: { top: "#66BB6A", body: "#52A85A", light: "#85CF88" },
  scripts: { top: "#FFA726", body: "#E8911A", light: "#FFBE5A" },
  bin: { top: "#FFA726", body: "#E8911A", light: "#FFBE5A" },
};

const DEFAULT_FOLDER = { top: "#DFB376", body: "#C19250", light: "#E8C280" };

interface Props {
  type: FileIconType;
  isFolderOpen?: boolean;
  /** 文件夹名(用于按名称着色, 如 src=蓝 node_modules=绿) */
  folderName?: string;
  size?: number;
}

export function FileIcon({ type, isFolderOpen, folderName, size = 16 }: Props) {
  // 文件夹: 按名称着色(参考 VS Code Material Icon Theme)
  if (type === "folder") {
    const c = (folderName && FOLDER_COLORS[folderName.toLowerCase()]) || DEFAULT_FOLDER;
    const gid = folderName ? `f-${folderName.replace(/[^a-zA-Z0-9]/g, "")}` : "f-default";
    if (isFolderOpen) {
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <defs>
            <linearGradient id={`${gid}-ot`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.light} />
              <stop offset="100%" stopColor={c.body} />
            </linearGradient>
            <linearGradient id={`${gid}-ob`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.top} />
              <stop offset="100%" stopColor={c.body} />
            </linearGradient>
          </defs>
          <path d="M1.5 4a1 1 0 011-1H6l1.5 1.5h6a1 1 0 011 1v1H4.5L2 8.5V4z" fill={`url(#${gid}-ot)`} />
          <path
            d="M2 8.5L4.5 6h10.5a.6.6 0 01.6.8l-1.6 5.5a1 1 0 01-1 .7H2.8a1 1 0 01-1-1.2L2 8.5z"
            fill={`url(#${gid}-ob)`}
          />
          <path d="M4.5 6h10.5l-.15.5H4.7L2.8 8.5H2.2L4.5 6z" fill={c.light} fillOpacity="0.4" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <defs>
          <linearGradient id={`${gid}-ct`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.light} />
            <stop offset="100%" stopColor={c.body} />
          </linearGradient>
          <linearGradient id={`${gid}-cb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="100%" stopColor={c.body} />
          </linearGradient>
        </defs>
        <path
          d="M1.5 4.5a1 1 0 011-1H6l1.5 1.3h6a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z"
          fill={`url(#${gid}-cb)`}
        />
        <path
          d="M1.5 4.5a1 1 0 011-1H6l1.5 1.3h6a1 1 0 011 1v.4H1.5v-1.7z"
          fill={`url(#${gid}-ct)`}
        />
        <path d="M2.5 4H5.8l.8.7H2.5V4z" fill={c.light} fillOpacity="0.45" />
      </svg>
    );
  }

  // 文件: 优先用品牌 Logo 图标(略小于容器尺寸, 视觉更协调)
  const IconComp = ICON_MAP[type];
  if (IconComp) {
    return <IconComp size={Math.round(size * 0.82)} color={ICON_COLORS[type]} />;
  }

  // 默认/配置/图片: 通用文件图标
  const color = ICON_COLORS[type] || ICON_COLORS.file;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 1.5a1 1 0 011-1H10L13 4v10a1 1 0 01-1 1H4.5a1 1 0 01-1-1v-12.5z"
        fill={color}
      />
      <path d="M10 0.5L13 4h-3V0.5z" fill="#ffffff" fillOpacity="0.3" />
    </svg>
  );
}
