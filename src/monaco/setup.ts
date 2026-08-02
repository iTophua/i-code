// Monaco 本地化配置
// 用本地打包的 monaco-editor, 而非 CDN, 避免网络依赖
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import { loader } from "@monaco-editor/react";

// 注册 web worker (vite 的 ?worker 导入)
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// 让 @monaco-editor/react 用本地实例, 而非 CDN
loader.config({ monaco });

// ★ 在 loader 初始化完成后注册主题(确保 monaco 实例就绪)
// loader.init() 返回 Promise, resolved 时 monaco 实例完全可用
import { defineIThemes, ICODE_DARK_THEME } from "./theme";
import { initBuiltinLanguages } from "./lsp-config";
loader.init().then((m) => {
  defineIThemes(m);
  initBuiltinLanguages(m);
});

export { monaco, ICODE_DARK_THEME };
