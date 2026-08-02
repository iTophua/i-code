import { JsonTool } from "./tools/JsonTool";
import { SqlTool } from "./tools/SqlTool";
import { EncodeTool } from "./tools/EncodeTool";
import { DevTool } from "./tools/DevTool";
import { TextDiffTool } from "./tools/TextDiffTool";
import "../styles/tools.css";

type ToolId = "json" | "sql" | "encode" | "dev" | "diff";

const COMPONENTS: Record<ToolId, () => JSX.Element> = {
  json: JsonTool,
  sql: SqlTool,
  encode: EncodeTool,
  dev: DevTool,
  diff: TextDiffTool,
};

/**
 * 工具在主编辑区以 Tab 形式打开时的容器
 * 每个工具 = 独立 Tab(tool:json / tool:sql ...), 这里只渲染对应工具内容,
 * 不再有顶部工具切换栏(避免多 Tab 间状态串扰; 工具间切换靠侧栏 ToolsPanel 重新打开)。
 */
export function ToolSurface({ tool }: { tool: string; title: string }) {
  const id = (Object.keys(COMPONENTS).includes(tool) ? tool : "json") as ToolId;
  const ToolComponent = COMPONENTS[id];

  return (
    <div className="tool-surface">
      <div className="tool-surface__content">
        <div className="tool-surface__scroll">
          <ToolComponent />
        </div>
      </div>
    </div>
  );
}
