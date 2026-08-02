import type { editor } from "monaco-editor";

/**
 * 为 standalone Monaco 实现 Option(Alt)+左键拖拽的矩形(列)选择。
 *
 * 背景: standalone Monaco 不内置 column/box selection(VS Code 专有,
 * 见 microsoft/monaco-editor#2035)。
 *
 * 实现: 全部用 Monaco 原生鼠标事件(onMouseDown/onMouseMove/onMouseUp),
 * 不在 DOM 捕获阶段拦截(避免干扰 Monaco 内部 mousedown/mouseup 配对,
 * 导致触控板点击移动误触发选区)。
 *
 * 额外: 修复 macOS 触控板「点击 A → 移动 → 点击 B 误选区」问题。
 * 原因: WKWebView 下触控板点击可能丢失 mouseup, Monaco 停留在「按下」状态,
 * 后续 mousemove 被当作拖拽选区扩展。这里在编辑器 DOM 上补一个 mouseup
 * 兜底, 确保每次点击后 Monaco 都能退出「按下」状态。
 */
export function setupColumnDrag(ed: editor.IStandaloneCodeEditor): () => void {
  let dragging = false;
  let start: { line: number; col: number } | null = null;
  const domNode = ed.getDomNode();
  if (!domNode) return () => {};

  // mousedown: 仅 Alt+左键进入列选(用 Monaco 原生事件, 不阻止默认行为)
  const downSub = ed.onMouseDown((e) => {
    if (!e.event.altKey || e.event.leftButton === false) return;
    const pos = e.target?.position;
    if (!pos) return;
    dragging = true;
    start = { line: pos.lineNumber, col: pos.column };
    applyRect(pos.lineNumber, pos.column);
  });

  // mousemove: 列选拖拽中实时更新
  const moveSub = ed.onMouseMove((e) => {
    if (!dragging || !start) return;
    const pos = e.target?.position;
    if (!pos) return;
    applyRect(pos.lineNumber, pos.column);
  });

  // mouseup: 结束列选(用 Monaco 原生事件)
  const upSub = ed.onMouseUp(() => {
    dragging = false;
    start = null;
  });

  /**
   * macOS 触控板修复: 触控板「点击 A → 移动鼠标 → 点击 B 误选区」。
   * 根因: 触控板点击产生 mousedown 后, Monaco 启动 GlobalEditorMoveMonitor
   * 监听 pointermove 来做拖拽选择。触控板移动光标(无按键)时仍产生 pointermove,
   * 如果此时 MouseDownOperation 未结束 → 选区被扩展。
   *
   * 修复: 在编辑器 DOM 的捕获阶段拦截 pointermove, 当 buttons=0(无按键按下)时
   * 阻止事件传播, Monaco 的拖拽选择监听器收不到 → 不扩展选区。
   */
  const onPointerMoveCapture = (e: PointerEvent) => {
    // 无物理按键按下时, 阻止 pointermove 传给 Monaco 的拖拽选择逻辑
    if (e.buttons === 0) {
      e.stopPropagation();
    }
  };
  domNode.addEventListener("pointermove", onPointerMoveCapture, true);

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

  return () => {
    downSub.dispose();
    moveSub.dispose();
    upSub.dispose();
    domNode.removeEventListener("pointermove", onPointerMoveCapture, true);
  };
}

