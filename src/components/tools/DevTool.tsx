import { useState } from "react";
import { toast } from "../../stores/toastStore";

export function DevTool() {
  return (
    <div>
      <JwtTool />
      <TimestampTool />
      <HashTool />
      <UuidTool />
    </div>
  );
}

function JwtTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const decode = () => {
    try {
      const parts = input.trim().split(".");
      if (parts.length < 2) throw new Error("JWT 格式错误");
      const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const result = {
        header,
        payload,
        ...(payload.exp ? { expired: Date.now() / 1000 > payload.exp } : {}),
      };
      setOutput(JSON.stringify(result, null, 2));
    } catch (e) {
      toast.error(`JWT 解码失败: ${(e as Error).message}`);
    }
  };

  return (
    <div className="tool-section">
      <div className="tool-section__title">JWT 解码</div>
      <textarea className="tool-textarea" placeholder="eyJhbGc..." value={input} onChange={(e) => setInput(e.target.value)} />
      <div className="tool-actions">
        <button className="tool-btn tool-btn--primary" onClick={decode}>解码</button>
      </div>
      {output && <div className="tool-output">{output}</div>}
    </div>
  );
}

function TimestampTool() {
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000)));
  const [date, setDate] = useState("");

  const tsToDate = () => {
    const d = new Date(parseInt(ts) * (ts.length > 10 ? 1 : 1000));
    setDate(d.toLocaleString("zh-CN"));
  };

  const now = () => setTs(String(Math.floor(Date.now() / 1000)));

  return (
    <div className="tool-section">
      <div className="tool-section__title">时间戳转换</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input className="tool-textarea" style={{ minHeight: "auto", height: 30 }} value={ts} onChange={(e) => setTs(e.target.value)} />
        <button className="tool-btn" onClick={now}>当前</button>
        <button className="tool-btn tool-btn--primary" onClick={tsToDate}>→ 日期</button>
      </div>
      {date && <div className="tool-output" style={{ minHeight: "auto", padding: "6px 8px" }}>{date}</div>}
    </div>
  );
}

function HashTool() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  const compute = async () => {
    try {
      const data = new TextEncoder().encode(input);
      const algorithms: Record<string, string> = {};
      for (const algo of ["SHA-1", "SHA-256", "SHA-512"]) {
        const buf = await crypto.subtle.digest(algo, data);
        algorithms[algo] = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
      setHashes(algorithms);
    } catch (e) {
      toast.error(`哈希失败: ${(e as Error).message}`);
    }
  };

  return (
    <div className="tool-section">
      <div className="tool-section__title">哈希计算 (SHA)</div>
      <textarea className="tool-textarea" placeholder="输入文本..." value={input} onChange={(e) => setInput(e.target.value)} />
      <div className="tool-actions">
        <button className="tool-btn tool-btn--primary" onClick={compute}>计算</button>
      </div>
      {Object.entries(hashes).map(([algo, hash]) => (
        <div key={algo} style={{ marginTop: 8 }}>
          <div className="tool-section__title">{algo}</div>
          <div className="tool-output" style={{ minHeight: "auto", padding: "4px 8px", fontSize: "var(--fs-2xs)", wordBreak: "break-all" }}>
            {hash}
          </div>
        </div>
      ))}
    </div>
  );
}

function UuidTool() {
  const [uuids, setUuids] = useState<string[]>([]);

  const generate = () => {
    const list = Array.from({ length: 5 }, () => crypto.randomUUID());
    setUuids(list);
  };

  return (
    <div className="tool-section">
      <div className="tool-section__title">UUID 生成</div>
      <div className="tool-actions">
        <button className="tool-btn tool-btn--primary" onClick={generate}>生成 5 个</button>
      </div>
      {uuids.map((u, i) => (
        <div key={i} className="tool-output" style={{ minHeight: "auto", padding: "4px 8px", marginTop: 4 }}>
          {u}
        </div>
      ))}
    </div>
  );
}
