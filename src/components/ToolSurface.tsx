import { useState } from "react";
import { JsonTool } from "./tools/JsonTool";
import { SqlTool } from "./tools/SqlTool";
import { EncodeTool } from "./tools/EncodeTool";
import { DevTool } from "./tools/DevTool";
import { TextDiffTool } from "./tools/TextDiffTool";
import {
  Braces,
  Database,
  Binary,
  Wrench,
  GitCompareArrows,
} from "lucide-react";
import { useEditorStore } from "../stores/editorStore";
import type { LucideIcon } from "lucide-react";
import "../styles/tools.css";

type ToolId = "json" | "sql" | "encode" | "dev" | "diff";

const TOOL_META: Record<ToolId, { label: string; desc: string; icon: LucideIcon }> = {
  json: { label: "JSON", desc: "格式化 / 压缩 / 校验", icon: Braces },
  sql: { label: "SQL", desc: "格式化 / 压缩", icon: Database },
  encode: { label: "编解码", desc: "Base64 / URL", icon: Binary },
  dev: { label: "开发工具", desc: "JWT / 时间戳 / 哈希 / UUID", icon: Wrench },
  diff: { label: "文本对比", desc: "两段文本差异对比", icon: GitCompareArrows },
};

const ORDER: ToolId[] = ["json", "sql", "encode", "dev", "diff"];

/**
 * 工具在主编辑区以 Tab 形式打开时的容器
 * - 顶部一行工具切换(横向 Tab)
 * - 下方渲染当前工具内容(自适应宽主区域)
 */
export function ToolSurface({ tool }: { tool: string; title: string }) {
  const [active, setActive] = useState<ToolId>(
    (ORDER.includes(tool as ToolId) ? tool : "json") as ToolId
  );

  const closeTab = useEditorStore((s) => s.closeTab);

  return (
    <div className="tool-surface">
      {/* 顶部工具切换栏 */}
      <div className="tool-surface__bar">
        <div className="tool-surface__tabs">
          {ORDER.map((id) => {
            const meta = TOOL_META[id];
            const Icon = meta.icon;
            const isActive = id === active;
            return (
              <button
                key={id}
                className={`tool-surface__tab ${isActive ? "tool-surface__tab--active" : ""}`}
                onClick={() => setActive(id)}
                title={meta.desc}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
        <button
          className="tool-surface__close"
          onClick={() => closeTab(`tool:${tool}`)}
          title="关闭工具"
        >
          ×
        </button>
      </div>

      {/* 工具内容区(自适应主区域宽度) */}
      <div className="tool-surface__content">
        <div className="tool-surface__scroll">
          {active === "json" && <JsonTool />}
          {active === "sql" && <SqlTool />}
          {active === "encode" && <EncodeTool />}
          {active === "dev" && <DevTool />}
          {active === "diff" && <TextDiffTool />}
        </div>
      </div>
    </div>
  );
}
