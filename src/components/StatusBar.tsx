import { useState, useEffect } from "react";
import { useEditorStore } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { readFile } from "@tauri-apps/plugin-fs";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "./Icons";
import { toast } from "../stores/toastStore";
import "./ui/radix-theme.css";
import "../styles/statusbar.css";

const ENCODINGS = [
  { value: "utf-8", label: "UTF-8" },
  { value: "gbk", label: "GBK" },
  { value: "big5", label: "Big5" },
  { value: "shift_jis", label: "Shift-JIS" },
  { value: "latin1", label: "ISO-8859-1" },
  { value: "windows-1252", label: "Windows-1252" },
];

export function StatusBar() {
  const activeTab = useEditorStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  );
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const updateContent = useEditorStore((s) => s.updateContent);
  const markSaved = useEditorStore((s) => s.markSaved);
  const [encoding, setEncoding] = useState("utf-8");
  const [lineEnding, setLineEnding] = useState("LF");

  // 计算相对路径(包名/目录/文件名)
  const relPath = (() => {
    if (!activeTab || activeTab.kind !== "file" || !workspaceRoot) return "";
    const p = activeTab.path;
    return p.startsWith(workspaceRoot) ? p.slice(workspaceRoot.length + 1) : p;
  })();

  useEffect(() => {
    setEncoding("utf-8");
  }, [activeTab?.id]);

  const handleEncodingChange = async (newEnc: string) => {
    if (!activeTab || activeTab.kind !== "file") return;
    try {
      const bytes = await readFile(activeTab.path);
      const decoder = new TextDecoder(newEnc);
      const content = decoder.decode(bytes);
      updateContent(activeTab.id, content);
      markSaved(activeTab.id);
      setEncoding(newEnc);
    } catch (e) {
      console.error("切换编码失败:", e);
      toast.error(`切换编码失败: ${e}`);
    }
  };

  if (!activeTab) {
    return <div className="status-bar" />;
  }

  return (
    <div className="status-bar">
      <div className="status-bar__left">
        <span className="status-item">
          {activeTab.isDirty ? "● " : ""}
          {relPath || activeTab.name}
        </span>
      </div>
      <div className="status-bar__right">
        {activeTab.kind === "file" && (
          <Select.Root value={encoding} onValueChange={handleEncodingChange}>
            <Select.Trigger className="status-bar__encoding-trigger" title="文件编码">
              <Select.Value />
              <Select.Icon>
                <ChevronDown size={10} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="status-bar__encoding-content">
                <Select.Viewport>
                  {ENCODINGS.map((enc) => (
                    <Select.Item key={enc.value} value={enc.value}>
                      <Select.ItemText>{enc.label}</Select.ItemText>
                      <Select.ItemIndicator className="status-bar__encoding-check">
                        <Check size={11} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        )}
        <button
          className="status-item status-item--btn"
          onClick={() => setLineEnding(lineEnding === "LF" ? "CRLF" : "LF")}
          title="行尾符"
        >
          {lineEnding}
        </button>
        <span className="status-item">{activeTab.language}</span>
      </div>
    </div>
  );
}
