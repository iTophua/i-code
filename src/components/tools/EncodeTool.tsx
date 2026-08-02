import { useState } from "react";
import { toast } from "../../stores/toastStore";

export function EncodeTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"base64" | "url">("base64");

  const encode = () => {
    try {
      if (mode === "base64") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(encodeURIComponent(input));
      }
    } catch (e) {
      toast.error(`编码失败: ${(e as Error).message}`);
    }
  };

  const decode = () => {
    try {
      if (mode === "base64") {
        setOutput(decodeURIComponent(escape(atob(input))));
      } else {
        setOutput(decodeURIComponent(input));
      }
    } catch (e) {
      toast.error(`解码失败: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="tool-section">
        <div className="tool-section__title">模式</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            className={`tool-btn ${mode === "base64" ? "tool-btn--primary" : ""}`}
            onClick={() => { setMode("base64"); setOutput(""); }}
          >Base64</button>
          <button
            className={`tool-btn ${mode === "url" ? "tool-btn--primary" : ""}`}
            onClick={() => { setMode("url"); setOutput(""); }}
          >URL</button>
        </div>
      </div>
      <div className="tool-section">
        <div className="tool-section__title">输入</div>
        <textarea
          className="tool-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="tool-actions">
          <button className="tool-btn tool-btn--primary" onClick={encode}>编码</button>
          <button className="tool-btn" onClick={decode}>解码</button>
          <button className="tool-btn" onClick={() => { setInput(""); setOutput(""); }}>清空</button>
        </div>
      </div>
      <div className="tool-section">
        <div className="tool-section__title">输出</div>
        <div className="tool-output">{output}</div>
        {output && (
          <button className="tool-btn" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(output); toast.success("已复制"); }}>复制</button>
        )}
      </div>
    </div>
  );
}
