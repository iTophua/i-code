import { useState } from "react";
import { format as sqlFormat } from "sql-formatter";
import { toast } from "../../stores/toastStore";

export function SqlTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const format = () => {
    try {
      const formatted = sqlFormat(input, { language: "mysql" });
      setOutput(formatted);
      toast.success("格式化成功");
    } catch (e) {
      toast.error(`格式化失败: ${(e as Error).message}`);
    }
  };

  const minify = () => {
    try {
      const formatted = sqlFormat(input, { language: "mysql" });
      setOutput(formatted.replace(/\s+/g, " ").trim());
      toast.success("压缩成功");
    } catch (e) {
      toast.error(`压缩失败: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="tool-section">
        <div className="tool-section__title">SQL 输入</div>
        <textarea
          className="tool-textarea"
          placeholder="SELECT * FROM users WHERE id = 1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ minHeight: 100 }}
        />
        <div className="tool-actions">
          <button className="tool-btn tool-btn--primary" onClick={format}>格式化</button>
          <button className="tool-btn" onClick={minify}>压缩</button>
          <button className="tool-btn" onClick={() => { setInput(""); setOutput(""); }}>清空</button>
        </div>
      </div>
      <div className="tool-section">
        <div className="tool-section__title">输出</div>
        <div className="tool-output" style={{ minHeight: 100 }}>{output}</div>
        {output && (
          <button className="tool-btn" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(output); toast.success("已复制"); }}>复制</button>
        )}
      </div>
    </div>
  );
}
