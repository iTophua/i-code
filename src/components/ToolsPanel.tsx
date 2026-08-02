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
  ArrowUpRight,
} from "lucide-react";
import { useEditorStore } from "../stores/editorStore";
import type { LucideIcon } from "lucide-react";
import "../styles/tools.css";

type ToolId = "json" | "sql" | "encode" | "dev" | "diff";

const TOOLS: { id: ToolId; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "json", label: "JSON", icon: Braces, desc: "格式化 / 压缩 / 校验" },
  { id: "sql", label: "SQL", icon: Database, desc: "格式化 / 压缩" },
  { id: "encode", label: "编解码", icon: Binary, desc: "Base64 / URL" },
  { id: "dev", label: "开发工具", icon: Wrench, desc: "JWT / 时间戳 / 哈希 / UUID" },
  { id: "diff", label: "文本对比", icon: GitCompareArrows, desc: "两段文本差异对比" },
];

/**
 * 侧栏工具入口列表
 * 点击某项 → 在主编辑区以 Tab 形式打开该工具
 */
export function ToolsPanel() {
  const openTool = useEditorStore((s) => s.openTool);

  const handleOpen = (tool: ToolId, label: string) => {
    openTool({ tool, title: `工具: ${label}` });
  };

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
              onClick={() => handleOpen(tool.id, tool.label)}
              title={`在主区域打开「${tool.label}」工具`}
            >
              <span className="tool-item__icon">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <div className="tool-item__info">
                <span className="tool-item__name">{tool.label}</span>
                <span className="tool-item__desc">{tool.desc}</span>
              </div>
              <ArrowUpRight size={14} className="tool-item__open" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 保留导出供主区域 ToolSurface 直接引用
export { JsonTool, SqlTool, EncodeTool, DevTool, TextDiffTool };
