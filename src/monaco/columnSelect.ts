import type { editor } from "monaco-editor";

/**
 * 为 standalone Monaco 实现 Option(Alt)+左键拖拽的矩形(列)选择。
 *
 * 背景: standalone Monaco 不内置 column/box selection(VS Code 专有特性,
 * 见 microsoft/monaco-editor#2035)。这里手动实现:
 * - mousedown 时若 altKey 按下 → 记录起点位置(行列), 标记进入列选拖拽
 * - mousemove 时计算起点到当前鼠标位置的矩形范围,
 *   为范围内每一行在该列区间设置光标 + 选区(多光标模拟列选)
 * - mouseup 结束
 *
 * 这样拖拽出一个矩形块, 块内每行都有光标, 即可同时编辑(列编辑)。
 */
export function setupColumnDrag(ed: editor.IStandaloneCodeEditor): () => void {
  let dragging = false;
  let start: { line: number; col: number } | null = null;
  const domNode = ed.getDomNode();
  if (!domNode) return () => {};

  const onMouseDown = (e: MouseEvent) => {
    // 仅 Option/Alt + 左键 触发列选
    if (!e.altKey || e.button !== 0) return;
    const pos = ed.getTargetAtClientPoint(e.clientX, e.clientY);
    if (!pos || !pos.position) return;
    // 阻止 Monaco 默认的 Alt+Click 加单光标, 改由我们接管
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    start = { line: pos.position.lineNumber, col: pos.position.column };
    updateRect(pos.position.lineNumber, pos.position.column);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging || !start) return;
    const pos = ed.getTargetAtClientPoint(e.clientX, e.clientY);
    if (!pos || !pos.position) return;
    updateRect(pos.position.lineNumber, pos.position.column);
  };

  const onMouseUp = () => {
    dragging = false;
    start = null;
  };

  /** 根据起点和当前点计算矩形, 为每行设置选区(列编辑) */
  const updateRect = (curLine: number, curCol: number) => {
    if (!start) return;
    const model = ed.getModel();
    if (!model) return;
    const lineFrom = Math.min(start.line, curLine);
    const lineTo = Math.max(start.line, curLine);
    const colFrom = Math.min(start.col, curCol);
    const colTo = Math.max(start.col, curCol);
    // setSelections: 多个选区 = 多个光标(列选)
    const selections: {
      selectionStartLineNumber: number;
      selectionStartColumn: number;
      positionLineNumber: number;
      positionColumn: number;
    }[] = [];
    for (let line = lineFrom; line <= lineTo; line++) {
      // 列号不超过该行最大列数 + 1(Monaco 列从 1 开始, 末尾列 = length+1)
      const maxCol = model.getLineMaxColumn(line);
      const cFrom = Math.min(colFrom, maxCol);
      const cTo = Math.min(colTo, maxCol);
      selections.push({
        selectionStartLineNumber: line,
        selectionStartColumn: cFrom,
        positionLineNumber: line,
        positionColumn: cTo,
      });
    }
    ed.setSelections(selections);
    ed.focus();
  };

  // 捕获阶段监听, 优先于 Monaco 内部处理
  domNode.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    domNode.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}
