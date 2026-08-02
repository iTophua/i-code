import type { editor } from "monaco-editor";

/**
 * 为 standalone Monaco 实现 Option(Alt)+左键拖拽的矩形(列)选择。
 *
 * 背景: standalone Monaco 不内置 column/box selection(VS Code 专有,
 * 见 microsoft/monaco-editor#2035)。
 *
 * 前提: 编辑器 multiCursorModifier 设为 'alt'(Option+点击加光标),
 * Option 不再被 Monaco 抢占, 可放心用于列选。
 *
 * 实现: DOM 捕获阶段拦截 mousedown, 仅 Alt+左键时接管(阻止 Monaco 默认),
 * 拖拽中用 editor.onMouseMove 原生事件实时取行列(坐标可靠), 对矩形范围每行 setSelections。
 */
export function setupColumnDrag(ed: editor.IStandaloneCodeEditor): () => void {
  let dragging = false;
  let start: { line: number; col: number } | null = null;
  const domNode = ed.getDomNode();
  if (!domNode) return () => {};

  // 捕获阶段拦截: 先于 Monaco, 仅 Alt+左键接管为列选
  const onMouseDownCapture = (e: MouseEvent) => {
    if (!e.altKey || e.button !== 0) return;
    const target = ed.getTargetAtClientPoint(e.clientX, e.clientY);
    const pos = target?.position;
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    start = { line: pos.lineNumber, col: pos.column };
    applyRect(pos.lineNumber, pos.column);
  };

  // 用 Monaco 原生 mousemove 取行列(比 getTargetAtClientPoint 稳定)
  const moveSub = ed.onMouseMove((e) => {
    if (!dragging || !start) return;
    const pos = e.target?.position;
    if (!pos) return;
    applyRect(pos.lineNumber, pos.column);
  });

  const onMouseUp = () => {
    dragging = false;
    start = null;
  };

  /** 矩形范围每行设选区(多光标 = 列编辑) */
  const applyRect = (curLine: number, curCol: number) => {
    if (!start) return;
    const model = ed.getModel();
    if (!model) return;
    const lineFrom = Math.min(start.line, curLine);
    const lineTo = Math.max(start.line, curLine);
    const colFrom = Math.min(start.col, curCol);
    const colTo = Math.max(start.col, curCol);
    const sels: {
      selectionStartLineNumber: number;
      selectionStartColumn: number;
      positionLineNumber: number;
      positionColumn: number;
    }[] = [];
    for (let line = lineFrom; line <= lineTo; line++) {
      const maxCol = model.getLineMaxColumn(line);
      sels.push({
        selectionStartLineNumber: line,
        selectionStartColumn: Math.min(colFrom, maxCol),
        positionLineNumber: line,
        positionColumn: Math.min(colTo, maxCol),
      });
    }
    ed.setSelections(sels);
    ed.focus();
  };

  domNode.addEventListener("mousedown", onMouseDownCapture, true);
  document.addEventListener("mouseup", onMouseUp);

  return () => {
    domNode.removeEventListener("mousedown", onMouseDownCapture, true);
    moveSub.dispose();
    document.removeEventListener("mouseup", onMouseUp);
  };
}
