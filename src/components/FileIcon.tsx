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

interface Props {
  type: FileIconType;
  isFolderOpen?: boolean;
  size?: number;
}

export function FileIcon({ type, isFolderOpen, size = 16 }: Props) {
  // 文件夹: 精致的 VS Code 风格(柔和渐变 + 清晰轮廓)
  if (type === "folder") {
    if (isFolderOpen) {
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <defs>
            <linearGradient id="folder-open-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DFB376" />
              <stop offset="100%" stopColor="#C19250" />
            </linearGradient>
            <linearGradient id="folder-open-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4A05A" />
              <stop offset="100%" stopColor="#B07A3E" />
            </linearGradient>
          </defs>
          {/* 后片(深色底) */}
          <path d="M1.5 4a1 1 0 011-1H6l1.5 1.5h6a1 1 0 011 1v1H4.5L2 8.5V4z" fill="url(#folder-open-top)" />
          {/* 前片(展开的文件夹主体) */}
          <path
            d="M2 8.5L4.5 6h10.5a.6.6 0 01.6.8l-1.6 5.5a1 1 0 01-1 .7H2.8a1 1 0 01-1-1.2L2 8.5z"
            fill="url(#folder-open-body)"
          />
          {/* 内部高光 */}
          <path d="M4.5 6h10.5l-.15.5H4.7L2.8 8.5H2.2L4.5 6z" fill="#E8C280" fillOpacity="0.4" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <defs>
          <linearGradient id="folder-closed-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DFB376" />
            <stop offset="100%" stopColor="#C19250" />
          </linearGradient>
          <linearGradient id="folder-closed-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A05A" />
            <stop offset="100%" stopColor="#B07A3E" />
          </linearGradient>
        </defs>
        {/* 主体 */}
        <path
          d="M1.5 4.5a1 1 0 011-1H6l1.5 1.3h6a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z"
          fill="url(#folder-closed-body)"
        />
        {/* 顶部标签 */}
        <path
          d="M1.5 4.5a1 1 0 011-1H6l1.5 1.3h6a1 1 0 011 1v.4H1.5v-1.7z"
          fill="url(#folder-closed-top)"
        />
        {/* 高光 */}
        <path d="M2.5 4H5.8l.8.7H2.5V4z" fill="#E8C280" fillOpacity="0.45" />
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
