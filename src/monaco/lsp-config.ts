import { languages } from "monaco-editor";

/**
 * Monaco 内置语言能力配置
 * TS/JS: 自带 tsserver(worker), 有补全/诊断/hover/跳转
 * JSON/CSS/HTML/SQL: 有基础支持
 *
 * 这些不需要外部 LSP server, 零成本开启
 */

/** TS/JS 诊断配置 */
export const tsDiagnosticsOptions = {
  noSemanticValidation: false,
  noSyntaxValidation: false,
  // 忽略常见误报(Monaco TS worker 缺少 node_modules 类型定义)
  diagnosticCodesToIgnore: [
    2307, // Cannot find module 'xxx' (worker 无 node_modules 解析)
    1259, // Module can only be default-imported usingesModuleInterop
    2792, // Cannot find module. Did you mean to enable allowSyntheticDefaultImports
    7026, // JSX element implicitly has type 'any' (无 @types/react, JSX.IntrinsicElements 未定义)
  ],
};

/** TS/JS 编译配置 */
export const tsCompilerOptions = {
  target: languages.typescript.ScriptTarget.ESNext,
  module: languages.typescript.ModuleKind.ESNext,
  moduleResolution: languages.typescript.ModuleResolutionKind.NodeJs,
  jsx: languages.typescript.JsxEmit.ReactJSX,
  allowNonTsExtensions: true,
  esModuleInterop: true,
  allowJs: true,
  // 编辑器场景放宽隐式 any 检查(回调参数无注解很常见, 实时提示太吵)
  strict: false,
  noImplicitAny: false,
  noEmit: true,
};

/**
 * 初始化 Monaco 内置语言能力
 * 在 monaco 实例就绪后调用
 */
export function initBuiltinLanguages(monacoInstance: typeof import("monaco-editor")) {
  const ts = monacoInstance.languages.typescript;

  // TypeScript
  ts.typescriptDefaults.setDiagnosticsOptions(tsDiagnosticsOptions);
  ts.typescriptDefaults.setCompilerOptions(tsCompilerOptions);

  // JavaScript
  ts.javascriptDefaults.setDiagnosticsOptions(tsDiagnosticsOptions);
  ts.javascriptDefaults.setCompilerOptions(tsCompilerOptions);

  // 注入 JSX 类型声明(无 @types/react 时, 让 JSX.IntrinsicElements 有定义)
  const jsxTypes = `
    interface ReactNode {}
    interface DOMElement {}
    declare global {
      namespace JSX {
        interface Element extends DOMElement {}
        interface ElementClass {}
        interface ElementAttributesProperty { props: {}; }
        interface ElementChildrenAttribute { children: {}; }
        type LibraryManagedAttributes<C, P> = P;
        interface IntrinsicAttributes {}
        interface IntrinsicClassAttributes<T> {}
        interface IntrinsicElements {
          [elemName: string]: any;
        }
      }
    }
  `;
  ts.typescriptDefaults.addExtraLib(jsxTypes, "file:///jsx.d.ts");
  ts.javascriptDefaults.addExtraLib(jsxTypes, "file:///jsx.d.ts");

  // 启用语义级诊断(实时)
  ts.typescriptDefaults.setEagerModelSync(true);
  ts.javascriptDefaults.setEagerModelSync(true);
}

/**
 * 外部 LSP server 探测配置
 * 探测系统 PATH 中已安装的 server, 有则启用
 */
export interface LspServerConfig {
  language: string;
  command: string;
  args: string[];
  /** 探测命令(返回 0 = 已安装) */
  detect: string;
  detectArgs?: string[];
  /** 文件扩展名 */
  extensions: string[];
}

export const LSP_SERVERS: LspServerConfig[] = [
  {
    language: "go",
    command: "gopls",
    args: ["serve"],
    detect: "gopls",
    detectArgs: ["version"],
    extensions: [".go"],
  },
  {
    language: "python",
    command: "pyright-langserver",
    args: ["--stdio"],
    detect: "pyright-langserver",
    extensions: [".py"],
  },
  {
    language: "rust",
    command: "rust-analyzer",
    args: [],
    detect: "rust-analyzer",
    detectArgs: ["--version"],
    extensions: [".rs"],
  },
];
