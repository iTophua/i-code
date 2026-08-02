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
    "editorGutter.background": "#191919",
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
    { token: "comment", foreground: "008000", fontStyle: "italic" },
    { token: "number", foreground: "098658" },
    { token: "type", foreground: "267F99" },
    { token: "class", foreground: "267F99" },
    { token: "function", foreground: "795E26" },
    { token: "variable", foreground: "001080" },
    { token: "constant", foreground: "0070C1" },
    { token: "tag", foreground: "800000" },
    { token: "attribute.name", foreground: "FF0000" },
  ],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#333333",
    "editorLineNumber.foreground": "#8a8a8a",
    "editorLineNumber.activeForeground": "#333333",
    "editorCursor.foreground": "#333333",
    "editor.selectionBackground": "#ADD6FF",
    "editor.lineHighlightBackground": "#F0F0F0",
    "editorIndentGuide.background": "#D4D4D4",
    "editorGutter.background": "#FFFFFF",
    "editorError.foreground": "#D12424",
    "editorWarning.foreground": "#B88500",
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
    // 行号与代码之间的间距(让第一列内容不贴行号, 光标更好点入)
    lineDecorationsWidth: 16,
    // ===== 多光标 / 列选择编辑 =====
    // multiCursorModifier: 'ctrlCmd' → Cmd+点击加光标(Monaco 默认 alt 会让 Option 冲突);
    //                       Option(Alt) 让给 setupColumnDrag 做矩形列选拖拽
    // multiCursorPaste: 多光标下粘贴按各自光标分行粘贴
    columnSelection: false,
    multiCursorModifier: "ctrlCmd",
    multiCursorPaste: "full",
    ...overrides,
  };
}
