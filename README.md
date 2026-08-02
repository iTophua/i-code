# iCode

轻量级代码编辑器，基于 Tauri 2 + React + Monaco Editor 构建。

![iCode](src-tauri/icons/icon.png)

## ✨ 功能特性

### 编辑器
- **Monaco Editor** — 语法高亮、智能补全、代码格式化、多光标编辑
- **列选择编辑** — Option + 拖拽矩形选区（独立实现，补全 standalone Monaco 缺失能力）
- **分屏编辑** — 支持左右 / 上下分栏，独立 Tab 体系
- **Markdown 实时预览** — 并排源码 + 预览，三态切换（分屏 / 仅预览 / 仅源码）
- **Diff 对比** — 与分支比较、文件历史版本对比
- **图片预览** — 支持 PNG / JPG / GIF / SVG / WebP / BMP / ICO，缩放浏览

### 文件管理
- **文件树** — 彩色文件夹图标、Git 状态标记、隐藏文件切换、筛选
- **全局搜索** — 跨文件内容搜索，正则支持
- **便签** — 内置轻量笔记，支持多语言高亮、自动保存
- **工具** — 内置工具面板（JSON 格式化、SQL 格式化等）
- **Tab 管理** — 按菜单域隔离、批量关闭、换行/滚动模式

### Git 集成
- **分支切换** — 文件树顶部内联分支选择器
- **变更管理** — 暂存 / 取消暂存 / 提交，状态分组
- **代码追溯（Blame）** — 独立左侧面板，逐行显示日期 + 作者，悬浮查看提交摘要
- **提交历史** — 弹窗查看文件历史，点击对比版本
- **分支管理 / Stash 管理 / 合并编辑器**

### 终端
- **内嵌终端** — xterm.js + PTY 持久会话
- **项目目录自动定位** — 打开即 cd 到工作区
- **主题跟随** — 深浅色自动切换

### 主题与体验
- **深色 / 浅色主题** — 三层令牌系统（调色板 → 语义 → 命名主题）
- **精致滚动条** — 全局统一 5px 细条，主题色递进
- **启动闪屏** — 品牌动画 + 加载指示
- **全局快捷键** — 命令面板（Cmd+Shift+P）、设置（Cmd+,）、分栏（Cmd+\）
- **Toast 提示** — 类型色强调条 + 圆形图标
- **中文右键菜单** — 全中文编辑器右键菜单（剪切/复制/粘贴/查找/替换/格式化/Git）

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | **Tauri 2**（Rust 后端 + WKWebView） |
| 前端 | **React 18** + **TypeScript** + **Vite** |
| 编辑器 | **Monaco Editor**（本地打包，零 CDN 依赖） |
| 状态管理 | **Zustand** |
| 终端 | **xterm.js**（xterm + addon-fit + addon-web-links） |
| UI 组件 | **Radix UI Primitives**（Dialog / Select / ContextMenu） |
| 图标 | **lucide-react** |
| 持久化 | **SQLite**（tauri-plugin-sql）— Tab / 便签 / 会话恢复 |
| 样式 | **纯 CSS** + **CSS Variables**（无 Tailwind 运行时） |

## 📁 项目结构

```
i-code/
├── src/
│   ├── components/       # React 组件
│   │   ├── EditorPane.tsx     # 主编辑器（文件/diff/blame/图片分发）
│   │   ├── FileTree.tsx       # 文件树
│   │   ├── GitPanel.tsx       # Git 面板
│   │   ├── TerminalView.tsx   # 终端
│   │   ├── SplashScreen.tsx   # 启动动画
│   │   └── ...
│   ├── stores/           # Zustand 状态管理
│   ├── styles/           # CSS（按模块拆分）
│   ├── monaco/           # Monaco 配置（主题/worker/LSP）
│   ├── utils/            # 工具函数
│   └── App.tsx           # 应用入口
├── src-tauri/
│   ├── src/
│   │   ├── fs_ops.rs     # 文件系统操作
│   │   ├── terminal.rs   # PTY 终端
│   │   ├── git.rs        # Git 命令封装
│   │   ├── search.rs     # 全局搜索
│   │   └── lsp.rs        # LSP 进程管理
│   ├── icons/            # 应用图标
│   ├── capabilities/     # Tauri 权限配置
│   └── tauri.conf.json   # Tauri 配置
└── package.json
```

## 🚀 快速开始

### 环境要求
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/)（stable）
- macOS: Xcode Command Line Tools
- Windows: Visual Studio C++ Build Tools
- Linux:webkit2gtk 等系统依赖

### 安装与运行

```bash
# 安装依赖
pnpm install

# 开发模式（同时启动 Vite + Tauri）
pnpm tauri dev

# 打包构建
pnpm tauri build
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + O` | 打开文件夹 |
| `Cmd/Ctrl + B` | 切换侧栏 |
| `Cmd/Ctrl + \` | 切换分栏 |
| `Cmd/Ctrl + ,` | 打开设置 |
| `Cmd/Ctrl + Shift + P` | 命令面板 |
| `Cmd/Ctrl + Shift + F` | 全局搜索 |
| `Cmd/Ctrl + Shift + V` | Markdown 视图切换 |
| `Cmd/Ctrl + W` | 关闭当前 Tab |
| `Cmd/Ctrl + Shift + T` | 恢复关闭的 Tab |
| `Ctrl + `` ` | 切换终端 |
| `Option + 拖拽` | 列选择 |

## 📄 License

MIT
