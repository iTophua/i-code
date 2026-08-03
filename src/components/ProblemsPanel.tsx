import { useEffect } from "react";
import { useProblemsStore, type ProblemItem } from "../stores/problemsStore";
import { useEditorStore } from "../stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import { getLanguage } from "../utils/language";
import { CircleAlert, TriangleAlert, Info } from "lucide-react";
import "../styles/problems.css";

const SEVERITY_ICON = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

export function ProblemsPanel({ visible = true }: { visible?: boolean }) {
  const { problems, refresh } = useProblemsStore();

  // 定时刷新(每 2 秒) —— 仅面板可见时轮询, 隐藏时停掉以减少 getModels 遍历开销
  useEffect(() => {
    if (!visible) return;
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh, visible]);

  // 切回可见时立即刷新一次(展示最新 markers, 而非等下一个 2s tick)
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  // 按文件分组
  const grouped = problems.reduce<Record<string, ProblemItem[]>>((acc, p) => {
    if (!acc[p.file]) acc[p.file] = [];
    acc[p.file].push(p);
    return acc;
  }, {});

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  // 点击跳转到问题位置
  const handleJump = async (problem: ProblemItem) => {
    const { openFile, tabs } = useEditorStore.getState();
    const existing = tabs.find((t) => t.path === problem.file);
    if (existing) {
      useEditorStore.getState().setActiveTab(existing.id);
    } else {
      try {
        const [content] = await invoke<[string, string]>("read_file", { filePath: problem.file });
        openFile({
          path: problem.file,
          name: problem.fileName,
          content,
          language: getLanguage(problem.fileName),
          preview: false,
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="problems-panel">
      <div className="problems-panel__header">
        <span className="problems-panel__title">问题</span>
        <div className="problems-panel__counts">
          {errorCount > 0 && (
            <span className="problems-panel__count problems-panel__count--error">
              <CircleAlert size={12} /> {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="problems-panel__count problems-panel__count--warning">
              <TriangleAlert size={12} /> {warningCount}
            </span>
          )}
          {problems.length === 0 && (
            <span className="problems-panel__count problems-panel__count--ok">无问题</span>
          )}
        </div>
      </div>
      <div className="problems-panel__list">
        {Object.entries(grouped).map(([file, items]) => (
          <div key={file} className="problem-group">
            <div className="problem-group__header" title={file}>
              <span className="problem-group__name">{items[0].fileName}</span>
              <span className="problem-group__path">{file}</span>
              <span className="problem-group__count">{items.length}</span>
            </div>
            {items.map((p, i) => {
              const Icon = SEVERITY_ICON[p.severity];
              return (
                <div
                  key={i}
                  className={`problem-item problem-item--${p.severity}`}
                  onClick={() => handleJump(p)}
                  title={`${p.fileName}:${p.line}:${p.column}`}
                >
                  <Icon size={14} className="problem-item__icon" />
                  <span className="problem-item__msg">{p.message}</span>
                  <span className="problem-item__pos">{p.line}:{p.column}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
