import { create } from "zustand";
import { monaco } from "../monaco/setup";

/**
 * Problems 面板状态
 * 收集 Monaco 所有 model 的 markers(错误/警告)
 */

export interface ProblemItem {
  file: string;
  fileName: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning" | "info";
}

interface ProblemsStore {
  problems: ProblemItem[];
  /** 从 Monaco 刷新所有 markers */
  refresh: () => void;
  /** 清空 */
  clear: () => void;
}

export const useProblemsStore = create<ProblemsStore>((set) => ({
  problems: [],

  refresh: () => {
    if (!monaco) return;
    const models = monaco.editor.getModels();
    const problems: ProblemItem[] = [];

    for (const model of models) {
      const uri = model.uri.toString();
      // 跳过便签/diff 等非文件 model
      if (uri.startsWith("note:") || uri.startsWith("diff:") || uri.startsWith("inmemory://")) {
        continue;
      }
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      for (const m of markers) {
        const filePath = model.uri.path || uri;
        const fileName = filePath.split("/").pop() || filePath;
        let severity: ProblemItem["severity"] = "info";
        if (m.severity === 8) severity = "error";
        else if (m.severity === 4) severity = "warning";

        problems.push({
          file: filePath,
          fileName,
          line: m.startLineNumber,
          column: m.startColumn,
          message: m.message,
          severity,
        });
      }
    }

    set({ problems });
  },

  clear: () => set({ problems: [] }),
}));
