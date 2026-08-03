import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // 拆分巨型主 chunk(原 4.5MB): 把重量级依赖各自独立成 chunk,
    // 让浏览器/Tauri 并行加载、按需缓存, 降低主线程初始解析峰值。
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 只处理 node_modules 中的依赖, 业务代码留在 index
          if (!id.includes("node_modules")) return undefined;
          // React 运行时(几乎不变, 单独长期缓存)
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "react-vendor";
          }
          // Monaco 核心编辑器(大, 但 worker 已按语言拆分)
          if (id.includes("node_modules/monaco-editor/") ||
              id.includes("node_modules/@monaco-editor/react/")) {
            return "monaco-core";
          }
          // LSP 客户端
          if (id.includes("node_modules/monaco-languageclient/") ||
              id.includes("node_modules/vscode-languageclient/") ||
              id.includes("node_modules/vscode-languageserver-protocol/") ||
              id.includes("node_modules/vscode-jsonrpc/") ||
              id.includes("node_modules/vscode-uri/")) {
            return "lsp-client";
          }
          // Radix UI 原语
          if (id.includes("node_modules/@radix-ui/")) {
            return "radix-ui";
          }
          // 终端模拟器
          if (id.includes("node_modules/@xterm/")) {
            return "xterm";
          }
          // Markdown 渲染 + 消毒
          if (id.includes("node_modules/marked/") ||
              id.includes("node_modules/dompurify/")) {
            return "markdown";
          }
          return undefined;
        },
      },
    },
  },
}));
