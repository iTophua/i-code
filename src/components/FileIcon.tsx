import type { FileIconType } from "../utils/language";

/**
 * Seti 风格文件图标(VS Code 内置文件图标主题)
 *
 * 设计:
 *  - 统一文件轮廓 SVG(折角矩形), 深浅主题都用同一轮廓色(中性灰)
 *  - 中央按类型显示标识:字母(TS/JS/MD...)、符号({}/#/$)或小图形
 *  - 类型色降饱和度 + 提亮度, 适配深色背景; 浅色主题通过 CSS 自动调暗
 *  - 文件夹: 活页夹 SVG, 降饱和度配色
 *
 * 优点: 比 react-icons 品牌彩色 logo 更清爽统一, 主题适配好, 无外部图标依赖。
 */

/** 文件类型 → 标识文字 + 颜色 */
const TYPE_BADGE: Partial<Record<FileIconType, { label: string; color: string }>> = {
  ts: { label: "TS", color: "#519ABA" },
  tsx: { label: "TS", color: "#519ABA" },
  js: { label: "JS", color: "#CBCB41" },
  jsx: { label: "JS", color: "#CBCB41" },
  vue: { label: "V", color: "#41B883" },
  json: { label: "{}", color: "#CBCB41" },
  css: { label: "#", color: "#519ABA" },
  scss: { label: "#", color: "#CD6799" },
  html: { label: "<>", color: "#E37933" },
  md: { label: "M↓", color: "#519ABA" },
  go: { label: "Go", color: "#519ABA" },
  rust: { label: "R", color: "#DEA584" },
  python: { label: "Py", color: "#3572A5" },
  java: { label: "J", color: "#B07219" },
  csharp: { label: "C#", color: "#519ABA" },
  cpp: { label: "C+", color: "#519ABA" },
  c: { label: "C", color: "#519ABA" },
  php: { label: "PHP", color: "#A074C4" },
  ruby: { label: "Rb", color: "#701516" },
  swift: { label: "S", color: "#E37933" },
  kotlin: { label: "K", color: "#A97BFF" },
  sql: { label: "DB", color: "#E38C2C" },
  shell: { label: "$", color: "#89E051" },
  yaml: { label: "Y", color: "#CB171E" },
  docker: { label: "🐳", color: "#519ABA" },
  git: { label: "⚙", color: "#A074C4" },
  lock: { label: "🔒", color: "#90A4AE" },
  config: { label: "⚙", color: "#90A4AE" },
  image: { label: "🖼", color: "#A074C4" },
};

/**
 * 文件夹名称 → 颜色映射(提亮版, 参考 VS Code Material Icon Theme)
 * 三色:top( tab/前片)、body( 主体)、light( 高光)
 */
const FOLDER_COLORS: Record<string, { top: string; body: string; light: string }> = {
  src: { top: "#519ABA", body: "#427C97", light: "#7CC4DC" },
  source: { top: "#519ABA", body: "#427C97", light: "#7CC4DC" },
  components: { top: "#E0B02E", body: "#BD8C1C", light: "#F0CC52" },
  public: { top: "#E8A33D", body: "#C57F22", light: "#F5BC60" },
  assets: { top: "#E8A33D", body: "#C57F22", light: "#F5BC60" },
  static: { top: "#E8A33D", body: "#C57F22", light: "#F5BC60" },
  node_modules: { top: "#5FA04E", body: "#427A38", light: "#82C872" },
  docs: { top: "#519ABA", body: "#427C97", light: "#7CC4DC" },
  doc: { top: "#519ABA", body: "#427C97", light: "#7CC4DC" },
  config: { top: "#90A4AE", body: "#637079", light: "#B8C6CE" },
  configs: { top: "#90A4AE", body: "#637079", light: "#B8C6CE" },
  test: { top: "#F06292", body: "#CC4070", light: "#F88BB0" },
  tests: { top: "#F06292", body: "#CC4070", light: "#F88BB0" },
  __tests__: { top: "#F06292", body: "#CC4070", light: "#F88BB0" },
  lib: { top: "#A074C4", body: "#7E509E", light: "#BB91D4" },
  utils: { top: "#A074C4", body: "#7E509E", light: "#BB91D4" },
  hooks: { top: "#EF5350", body: "#CC3D3A", light: "#F77A77" },
  dist: { top: "#78909C", body: "#546E7A", light: "#9FAFB8" },
  build: { top: "#78909C", body: "#546E7A", light: "#9FAFB8" },
  out: { top: "#78909C", body: "#546E7A", light: "#9FAFB8" },
  target: { top: "#78909C", body: "#546E7A", light: "#9FAFB8" },
  styles: { top: "#EC407A", body: "#C12E64", light: "#F068A0" },
  css: { top: "#519ABA", body: "#427C97", light: "#7CC4DC" },
  images: { top: "#A074C4", body: "#7E509E", light: "#BB91D4" },
  img: { top: "#A074C4", body: "#7E509E", light: "#BB91D4" },
  locales: { top: "#26A69A", body: "#1A7A72", light: "#4DBCB2" },
  i18n: { top: "#26A69A", body: "#1A7A72", light: "#4DBCB2" },
  api: { top: "#66BB6A", body: "#449650", light: "#85CF88" },
  server: { top: "#66BB6A", body: "#449650", light: "#85CF88" },
  scripts: { top: "#FFA726", body: "#D87E12", light: "#FFBE5A" },
  bin: { top: "#FFA726", body: "#D87E12", light: "#FFBE5A" },
};

const DEFAULT_FOLDER = { top: "#E0A865", body: "#C08840", light: "#F0C280" };

interface Props {
  type: FileIconType;
  isFolderOpen?: boolean;
  /** 文件夹名(用于按名称着色) */
  folderName?: string;
  size?: number;
}

export function FileIcon({ type, isFolderOpen, folderName, size = 16 }: Props) {
  // 文件夹: 活页夹 SVG(降饱和度配色)
  if (type === "folder") {
    return (
      <FolderIcon
        size={size}
        colors={(folderName && FOLDER_COLORS[folderName.toLowerCase()]) || DEFAULT_FOLDER}
        isFolderOpen={isFolderOpen}
        folderName={folderName}
      />
    );
  }

  // 文件: 统一轮廓 + 类型标识
  const badge = TYPE_BADGE[type];
  return <FileGlyph size={size} badge={badge} />;
}

/** 文件轮廓 SVG(折角矩形)+ 中央类型标识 */
function FileGlyph({
  size,
  badge,
}: {
  size: number;
  badge?: { label: string; color: string };
}) {
  // 无标识的默认文件(纯文本等): 空白文件轮廓
  const label = badge?.label ?? "";
  // 单字符/双字符: 字号自适应; emoji 类(🐳/🔒/🖼/⚙)不缩字
  const isEmoji = label.length > 0 && /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(label);
  const fontSize = isEmoji ? size * 0.5 : label.length <= 1 ? size * 0.5 : size * 0.36;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className="file-icon"
      aria-hidden
    >
      {/* 文件轮廓(中性灰, 主题适配) */}
      <path
        d="M3.5 1a1 1 0 00-1 1v12a1 1 0 001 1h9a1 1 0 001-1V5.2a1 1 0 00-.3-.7L9.5 1.3a1 1 0 00-.7-.3H3.5z"
        fill="var(--bg-icon-file, rgba(150,150,150,0.18))"
        stroke="var(--fg-icon-file, rgba(150,150,150,0.45))"
        strokeWidth="0.7"
      />
      {/* 折角 */}
      <path
        d="M9 1v3.2a.8.8 0 00.8.8H13"
        fill="none"
        stroke="var(--fg-icon-file, rgba(150,150,150,0.45))"
        strokeWidth="0.7"
      />
      {/* 类型标识 */}
      {label && (
        <text
          x="8"
          y="11"
          textAnchor="middle"
          fontSize={fontSize * (16 / size)}
          fontFamily="ui-monospace, 'SF Mono', Menlo, monospace"
          fontWeight="700"
          fill={badge!.color}
          className="file-icon__badge"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

/** 文件夹活页夹 SVG */
function FolderIcon({
  size,
  colors,
  isFolderOpen,
  folderName,
}: {
  size: number;
  colors: { top: string; body: string; light: string };
  isFolderOpen?: boolean;
  folderName?: string;
}) {
  const c = colors;
  // 唯一 gradient id(避免同名文件夹冲突)
  const gid = folderName
    ? `f-${folderName.replace(/[^a-zA-Z0-9]/g, "")}-${size}`
    : `f-default-${size}`;
  if (isFolderOpen) {
    // 展开态:前片( tab)+ 底片( 文档露出)
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        <defs>
          <linearGradient id={`${gid}-ob`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="100%" stopColor={c.body} />
          </linearGradient>
        </defs>
        {/* 底片(后方文档) */}
        <path
          d="M1.8 6.5h12.4a.5.5 0 01.5.6l-1.5 5.2a1 1 0 01-1 .7H2.8a1 1 0 01-1-1V7a.5.5 0 01.5-.5z"
          fill={c.body}
          opacity="0.7"
        />
        {/* 前片(tab) */}
        <path
          d="M1.5 3.5a1 1 0 011-1H6l1.5 1.5h5a1 1 0 011 1V6H1.5V3.5z"
          fill={`url(#${gid}-ob)`}
        />
        {/* 高光 */}
        <path d="M2.5 3.5h3L7 4.8H2.5V3.5z" fill={c.light} fillOpacity="0.5" />
      </svg>
    );
  }
  // 收起态:经典文件夹( tab + 主体)
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${gid}-cb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.top} />
          <stop offset="100%" stopColor={c.body} />
        </linearGradient>
      </defs>
      {/* 主体 */}
      <path
        d="M1.5 5a1 1 0 011-1H6l1.5 1.3h5.5a1 1 0 011 1V12a1 1 0 01-1 1H2.5a1 1 0 01-1-1V5z"
        fill={`url(#${gid}-cb)`}
      />
      {/* tab(顶部凸起) */}
      <path
        d="M1.5 5a1 1 0 011-1H6l1.5 1.3v.7H1.5V5z"
        fill={c.top}
      />
      {/* 高光 */}
      <path d="M2.5 4.3h3l.8.7H2.5v-.7z" fill={c.light} fillOpacity="0.45" />
    </svg>
  );
}
