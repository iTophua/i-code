import type { editor } from "monaco-editor";

/**
 * i-code 主题注册(对标 VS Code Dark+)
 * 色值来源: docs/主题规划.md 第四章
 */

export const ICODE_DARK_THEME = "i-code-dark";
export const ICODE_LIGHT_THEME = "i-code-light";

interface ThemeDef {
  rules: editor.ITokenThemeRule[];
  colors: Record<string, string>;
}

const darkDef: ThemeDef = {
  rules: [
    { token: "keyword", foreground: "569CD6" },
    { token: "keyword.operator", foreground: "D4D4D4" },
    { token: "string", foreground: "CE9178" },
    { token: "string.escape", foreground: "D7BA7D" },
    { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    { token: "number", foreground: "B5CEA8" },
    { token: "regexp", foreground: "D16969" },
    { token: "type", foreground: "4EC9B0" },
    { token: "type.identifier", foreground: "4EC9B0" },
    { token: "class", foreground: "4EC9B0" },
    { token: "interface", foreground: "B279A2" },
    { token: "function", foreground: "DCDCAA" },
    { token: "variable", foreground: "9CDCFE" },
    { token: "variable.predefined", foreground: "4FC1FF" },
    { token: "constant", foreground: "4FC1FF" },
    { token: "tag", foreground: "569CD6" },
    { token: "attribute.name", foreground: "9CDCFE" },
    { token: "attribute.value", foreground: "CE9178" },
    { token: "delimiter", foreground: "D4D4D4" },
    { token: "namespace", foreground: "B5CEA8" },
  ],
  colors: {
    "editor.background": "#1E1E1E",
    "editor.foreground": "#D4D4D4",
    "editorLineNumber.foreground": "#6E7681",
    "editorLineNumber.activeForeground": "#E6E6E6",
    "editorCursor.foreground": "#AEAFAD",
    "editor.selectionBackground": "#264F78",
    "editor.inactiveSelectionBackground": "#3A3D41",
    "editor.selectionHighlightBackground": "#ADD6FF80",
    "editor.lineHighlightBackground": "#2A2D2E",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background": "#404040",
    "editorIndentGuide.activeBackground": "#707070",
    "editorWhitespace.foreground": "#E3E4E229",
    "editor.findMatchBackground": "#515C6A",
    "editor.findMatchHighlightBackground": "#EA5C0055",
    "editorBracketMatch.background": "#0064001A",
    "editorBracketMatch.border": "#888",
    "editorGutter.background": "#1E1E1E",
    "editorError.foreground": "#F48771",
    "editorWarning.foreground": "#CCA700",
    "editorInfo.foreground": "#75BEFF",
    "editorWidget.background": "#252526",
    "editorWidget.border": "#454545",
    "editorSuggestWidget.background": "#252526",
    "editorSuggestWidget.border": "#454545",
    "editorSuggestWidget.selectedBackground": "#094771",
    "editorHoverWidget.background": "#252526",
    "scrollbar.shadow": "#00000033",
    "scrollbarSlider.background": "#79797966",
    "scrollbarSlider.hoverBackground": "#646464B3",
    "scrollbarSlider.activeBackground": "#BFBFBF66",
  },
};

/** 浅色主题(对标 VS Code Light+) */
const lightDef: ThemeDef = {
  rules: [
    { token: "keyword", foreground: "0000FF" },
    { token: "keyword.operator", foreground: "333333" },
    { token: "string", foreground: "A31515" },
    { token: "string.escape", foreground: "CE9178" },
    { token: "comment", foreground: "008000", fontStyle: "italic" },
    { token: "number", foreground: "098658" },
    { token: "regexp", foreground: "D16969" },
    { token: "type", foreground: "267F99" },
    { token: "type.identifier", foreground: "267F99" },
    { token: "class", foreground: "267F99" },
    { token: "interface", foreground: "B279A2" },
    { token: "function", foreground: "795E26" },
    { token: "variable", foreground: "001080" },
    { token: "variable.predefined", foreground: "0070C1" },
    { token: "constant", foreground: "0070C1" },
    { token: "tag", foreground: "800000" },
    { token: "attribute.name", foreground: "FF0000" },
    { token: "attribute.value", foreground: "A31515" },
    { token: "delimiter", foreground: "333333" },
    { token: "namespace", foreground: "098658" },
  ],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#333333",
    "editorLineNumber.foreground": "#8a8a8a",
    "editorLineNumber.activeForeground": "#333333",
    "editorCursor.foreground": "#333333",
    "editor.selectionBackground": "#ADD6FF",
    "editor.inactiveSelectionBackground": "#E5E5E5",
    "editor.selectionHighlightBackground": "#ADD6FF80",
    "editor.lineHighlightBackground": "#F0F0F0",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background": "#D4D4D4",
    "editorIndentGuide.activeBackground": "#B0B0B0",
    "editorWhitespace.foreground": "#33333333",
    "editor.findMatchBackground": "#A8ACB8",
    "editor.findMatchHighlightBackground": "#EA5C0033",
    "editorBracketMatch.background": "#0064001A",
    "editorBracketMatch.border": "#888",
    "editorGutter.background": "#FFFFFF",
    "editorError.foreground": "#D12424",
    "editorWarning.foreground": "#B88500",
    "editorInfo.foreground": "#75BEFF",
    "editorWidget.background": "#F3F3F3",
    "editorWidget.border": "#C8C8C8",
    "editorSuggestWidget.background": "#F3F3F3",
    "editorSuggestWidget.border": "#C8C8C8",
    "editorSuggestWidget.selectedBackground": "#0060C0",
    "editorHoverWidget.background": "#F3F3F3",
    "scrollbar.shadow": "#00000033",
    "scrollbarSlider.background": "#79797966",
    "scrollbarSlider.hoverBackground": "#646464B3",
    "scrollbarSlider.activeBackground": "#BFBFBF66",
  },
};

/** 注册主题(深色 + 浅色) */
export function defineIThemes(monacoInstance: typeof import("monaco-editor")) {
  monacoInstance.editor.defineTheme(ICODE_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: darkDef.rules,
    colors: darkDef.colors,
  });
  monacoInstance.editor.defineTheme(ICODE_LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: lightDef.rules,
    colors: lightDef.colors,
  });
  monacoInstance.editor.setTheme(ICODE_DARK_THEME);
}

/** Monaco editor 选项(统一配置) */
export function getEditorOptions(
  overrides: import("monaco-editor").editor.IStandaloneEditorConstructionOptions = {}
): import("monaco-editor").editor.IStandaloneEditorConstructionOptions {
  return {
    theme: ICODE_DARK_THEME,
    fontFamily: "SF Mono, Menlo, Monaco, Consolas, monospace",
    fontSize: 14,
    lineHeight: 21,
    fontLigatures: false,
    minimap: { enabled: true },
    automaticLayout: true,
    tabSize: 2,
    wordWrap: "off",
    smoothScrolling: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    renderWhitespace: "selection",
    renderLineHighlight: "all",
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    // 点击行号不选中整行(避免触控板误触)
    selectOnLineNumbers: false,
    // 禁用拖放(避免触控板点击后移动误触发选区拖拽)
    dragAndDrop: false,
    // 禁用 Monaco 自带右键菜单(英文, 用自定义中文菜单替代)
    contextmenu: false,
    // ===== 多光标 / 列选择编辑 =====
    // multiCursorModifier: 'alt' → Option+点击加光标(列选由 setupColumnDrag 捕获阶段接管,
    // 不冲突); 不用 ctrlCmd(macOS 上触控板手势可能误带 Cmd → 整行选择)
    columnSelection: false,
    multiCursorModifier: "alt",
    multiCursorPaste: "full",
    ...overrides,
  };
}
