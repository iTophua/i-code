import { useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { toast } from "../../stores/toastStore";

export function TextDiffTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const compare = () => {
    if (!left.trim() && !right.trim()) {
      toast.warning("请输入两段文本");
      return;
    }
    useEditorStore.getState().openDiff({
      title: "文本对比",
      original: left,
      modified: right,
      language: "plaintext",
    });
    toast.success("已在编辑区打开对比视图");
  };

  return (
    <div>
      <div className="tool-section">
        <div className="tool-section__title">原始文本</div>
        <textarea
          className="tool-textarea"
          placeholder="粘贴原始文本..."
          value={left}
          onChange={(e) => setLeft(e.target.value)}
          style={{ minHeight: 120 }}
        />
      </div>
      <div className="tool-section">
        <div className="tool-section__title">修改后文本</div>
        <textarea
          className="tool-textarea"
          placeholder="粘贴修改后文本..."
          value={right}
          onChange={(e) => setRight(e.target.value)}
          style={{ minHeight: 120 }}
        />
      </div>
      <div className="tool-actions">
        <button className="tool-btn tool-btn--primary" onClick={compare}>对比 (DiffEditor)</button>
        <button className="tool-btn" onClick={() => { setLeft(""); setRight(""); }}>清空</button>
      </div>
    </div>
  );
}
