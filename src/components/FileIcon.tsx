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
  // 文件夹: VS Code 风格活页夹
  if (type === "folder") {
    if (isFolderOpen) {
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* 后片(深色, 明显的暗部) */}
          <path
            d="M1.5 4.5a1 1 0 011-1H6l1.5 1.5h6a1 1 0 011 1v.5H4L1.5 8.5V4.5z"
            fill="#7A5A2E"
          />
          {/* 前片(亮色主色) */}
          <path
            d="M1.5 8.5L4 5.5h10.5l-2 7a.7.7 0 01-.7.5H2.2a.7.7 0 01-.7-.9V8.5z"
            fill={ICON_COLORS.folder}
          />
          {/* 前片高光 */}
          <path d="M1.5 8.5L4 5.5h10.5l-.3 1H4.2L2.2 9H1.5v-.5z" fill="#D4A663" fillOpacity="0.5" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        {/* 主体 */}
        <path
          d="M1.5 4a1 1 0 011-1H6l1.5 1.5h6a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z"
          fill={ICON_COLORS.folder}
        />
        {/* 顶部标签(深色) */}
        <path d="M1.5 4a1 1 0 011-1H6l1.5 1.5h6a1 1 0 011 1v.3H1.5V4z" fill="#7A5A2E" />
        {/* 高光 */}
        <path d="M2.5 3.5H6L7 4.5H2.5v-1z" fill="#D4A663" fillOpacity="0.5" />
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
