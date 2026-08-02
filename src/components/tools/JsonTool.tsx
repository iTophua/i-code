import { useState } from "react";
import { toast } from "../../stores/toastStore";

export function JsonTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setStatus("✓ 格式化成功");
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`);
    }
  };

  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setStatus("✓ 压缩成功");
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`);
    }
  };

  const validate = () => {
    try {
      JSON.parse(input);
      toast.success("JSON 格式正确");
      setStatus("✓ 格式正确");
    } catch (e) {
      toast.error(`JSON 格式错误: ${(e as Error).message}`);
      setStatus(`✗ ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="tool-section">
        <div className="tool-section__title">输入</div>
        <textarea
          className="tool-textarea"
          placeholder='{"key":"value"}'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="tool-actions">
          <button className="tool-btn tool-btn--primary" onClick={format}>格式化</button>
          <button className="tool-btn" onClick={minify}>压缩</button>
          <button className="tool-btn" onClick={validate}>校验</button>
          <button className="tool-btn" onClick={() => { setInput(""); setOutput(""); setStatus(""); }}>清空</button>
        </div>
        {status && <div className={`tool-status ${status.startsWith("✗") ? "tool-status--error" : ""}`}>{status}</div>}
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
