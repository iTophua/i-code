import { useState } from "react";
import { JsonTool } from "./tools/JsonTool";
import { SqlTool } from "./tools/SqlTool";
import { EncodeTool } from "./tools/EncodeTool";
import { DevTool } from "./tools/DevTool";
import { TextDiffTool } from "./tools/TextDiffTool";
import { Braces, Database, Binary, Wrench, GitCompareArrows } from "lucide-react";
import "../styles/tools.css";

type ToolId = "json" | "sql" | "encode" | "dev" | "diff";

const TOOLS: { id: ToolId; label: string; icon: typeof Braces; desc: string }[] = [
  { id: "json", label: "JSON", icon: Braces, desc: "格式化 / 压缩 / 校验" },
  { id: "sql", label: "SQL", icon: Database, desc: "格式化 / 压缩" },
  { id: "encode", label: "编解码", icon: Binary, desc: "Base64 / URL" },
  { id: "dev", label: "开发工具", icon: Wrench, desc: "JWT / 时间戳 / 哈希 / UUID" },
  { id: "diff", label: "文本对比", icon: GitCompareArrows, desc: "两段文本差异对比" },
];

export function ToolsPanel() {
  const [active, setActive] = useState<ToolId | null>(null);

  if (active) {
    return (
      <div className="tools-panel">
        <div className="tools-panel__back" onClick={() => setActive(null)}>
          ‹ 返回工具列表
        </div>
        <div className="tools-panel__content">
          {active === "json" && <JsonTool />}
          {active === "sql" && <SqlTool />}
          {active === "encode" && <EncodeTool />}
          {active === "dev" && <DevTool />}
          {active === "diff" && <TextDiffTool />}
        </div>
      </div>
    );
  }

  return (
    <div className="tools-panel">
      <div className="tools-panel__header">
        <span className="tools-panel__title">工具</span>
      </div>
      <div className="tools-panel__list">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className="tool-item"
              onClick={() => setActive(tool.id)}
            >
              <span className="tool-item__icon">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <div className="tool-item__info">
                <span className="tool-item__name">{tool.label}</span>
                <span className="tool-item__desc">{tool.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
