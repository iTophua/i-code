import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, RotateCcw } from "lucide-react";
import { useLayoutStore } from "../stores/layoutStore";
import type { SettingsCategory } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useFileTreeStore } from "../stores/fileTreeStore";
import { useLspStore } from "../stores/lspStore";
import { setSession, SESSION_KEYS } from "../utils/session";
import { AppSelect } from "./AppSelect";
import { ConfirmDialog } from "./ConfirmDialog";
import "./ui/radix-theme.css";
import "../styles/settings.css";

const CATEGORIES: { id: SettingsCategory; label: string; icon: string }[] = [
  { id: "theme", label: "主题", icon: "🎨" },
  { id: "editor", label: "编辑器", icon: "✏️" },
  { id: "terminal", label: "终端", icon: "🖥" },
  { id: "window", label: "窗口与文件", icon: "🗂" },
  { id: "lsp", label: "代码智能", icon: "🧠" },
];

/**
 * 设置弹窗(Radix Dialog): 左侧分类列表 + 右侧表单
 * - Cmd+, 或点击活动栏设置图标 打开
 * - 关闭后记忆上次选择的分类(持久化)
 */
export function SettingsDialog() {
  const open = useLayoutStore((s) => s.settingsOpen);
  const setOpen = useLayoutStore((s) => s.setSettingsOpen);
  const settingsCategory = useLayoutStore((s) => s.settingsCategory);
  const setSettingsCategory = useLayoutStore((s) => s.setSettingsCategory);
  const s = useSettingsStore();
  const [showReset, setShowReset] = useState(false);
  const current = CATEGORIES.find((c) => c.id === settingsCategory);

  const handleSelectCategory = (id: SettingsCategory) => {
    setSettingsCategory(id);
    // 持久化分类选择(重启记忆)
    setSession(SESSION_KEYS.settingsCategory, id).catch(() => {});
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => setOpen(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-overlay" />
        <Dialog.Content
          className="settings-dialog"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className="settings-dialog__title">
            设置
          </Dialog.Title>
          <button
            className="app-dialog-close"
            onClick={() => setOpen(false)}
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} strokeWidth={1.75} />
          </button>

          <div className="settings-dialog__body">
            {/* 左侧分类列表 */}
            <div className="settings-dialog__sidebar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`settings-dialog__cat ${settingsCategory === cat.id ? "settings-dialog__cat--active" : ""}`}
                  onClick={() => handleSelectCategory(cat.id)}
                >
                  <span className="settings-dialog__cat-icon">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
              <div className="settings-dialog__sidebar-spacer" />
              <button
                className="settings-dialog__reset"
                onClick={() => setShowReset(true)}
                title="重置所有设置"
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                <span>重置</span>
              </button>
            </div>

            {/* 右侧表单 */}
            <div className="settings-dialog__content">
              <div className="settings-dialog__content-header">
                {current?.icon} {current?.label}
              </div>
              <div className="settings-dialog__content-body">
                {settingsCategory === "theme" && <ThemeSettings s={s} />}
                {settingsCategory === "editor" && <EditorSettings s={s} />}
                {settingsCategory === "terminal" && <TerminalSettings s={s} />}
                {settingsCategory === "window" && <WindowSettings s={s} />}
                {settingsCategory === "lsp" && <LspSettings />}
              </div>
            </div>
          </div>

          <ConfirmDialog
            open={showReset}
            title="重置设置"
            message="确定要将所有设置恢复为默认值吗？"
            confirmLabel="重置"
            danger
            onConfirm={() => {
              useSettingsStore.getState().reset();
              setShowReset(false);
            }}
            onCancel={() => setShowReset(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type S = ReturnType<typeof useSettingsStore.getState>;

function ThemeSettings({ s }: { s: S }) {
  return (
    <Group title="外观">
      <Row label="配色主题" desc="切换深色/浅色主题">
        <AppSelect inline
          value={s.theme}
          options={[
            { value: "dark", label: "深色 (Dark+)" },
            { value: "light", label: "浅色 (Light+)" },
          ]}
          onChange={(v) => s.update("theme", v as S["theme"])}
        />
      </Row>
    </Group>
  );
}

function EditorSettings({ s }: { s: S }) {
  return (
    <>
      <Group title="字体">
        <Row label="字体族" desc="编辑器使用的等宽字体">
          <input className="settings__input" value={s.fontFamily} onChange={(e) => s.update("fontFamily", e.target.value)} />
        </Row>
        <Row label="字号">
          <input type="number" className="settings__input settings__input--num" value={s.fontSize} min={8} max={32} onChange={(e) => s.update("fontSize", Number(e.target.value))} />
        </Row>
        <Row label="行高">
          <input type="number" className="settings__input settings__input--num" value={s.lineHeight} min={1} max={3} step={0.1} onChange={(e) => s.update("lineHeight", Number(e.target.value))} />
        </Row>
        <Row label="字体连字" desc="需字体支持(如 Fira Code)">
          <Toggle value={s.fontLigatures} onChange={(v) => s.update("fontLigatures", v)} />
        </Row>
        <Row label="显示空白字符" desc="显示空格/制表符">
          <Toggle value={s.showWhitespace} onChange={(v) => s.update("showWhitespace", v)} />
        </Row>
      </Group>
      <Group title="编辑">
        <Row label="Tab 宽度">
          <input type="number" className="settings__input settings__input--num" value={s.tabSize} min={2} max={8} onChange={(e) => s.update("tabSize", Number(e.target.value))} />
        </Row>
        <Row label="自动换行" desc="长行是否折行显示">
          <AppSelect inline
            value={s.wordWrap}
            options={[
              { value: "off", label: "关闭" },
              { value: "on", label: "开启" },
            ]}
            onChange={(v) => s.update("wordWrap", v as S["wordWrap"])}
          />
        </Row>
        <Row label="小地图" desc="右侧缩略代码地图">
          <Toggle value={s.minimap} onChange={(v) => s.update("minimap", v)} />
        </Row>
        <Row label="自动保存">
          <AppSelect inline
            value={s.autoSave}
            options={[
              { value: "off", label: "关闭" },
              { value: "afterDelay", label: "延时保存" },
              { value: "onFocusChange", label: "失焦保存" },
            ]}
            onChange={(v) => s.update("autoSave", v as S["autoSave"])}
          />
        </Row>
      </Group>
      <Group title="标签栏">
        <Row label="标签换行" desc="开启后标签多了自动换行; 关闭则左右滑动(默认)">
          <Toggle value={s.tabWrap} onChange={(v) => s.update("tabWrap", v)} />
        </Row>
      </Group>
    </>
  );
}

function TerminalSettings({ s }: { s: S }) {
  return (
    <Group title="终端">
      <Row label="字体族">
        <input className="settings__input" value={s.terminalFontFamily} onChange={(e) => s.update("terminalFontFamily", e.target.value)} />
      </Row>
      <Row label="字号">
        <input type="number" className="settings__input settings__input--num" value={s.terminalFontSize} min={8} max={32} onChange={(e) => s.update("terminalFontSize", Number(e.target.value))} />
      </Row>
      <Row label="滚动缓冲" desc="保留的历史行数">
        <input type="number" className="settings__input settings__input--num" value={s.terminalScrollback} min={1000} max={50000} step={1000} onChange={(e) => s.update("terminalScrollback", Number(e.target.value))} />
      </Row>
    </Group>
  );
}

function WindowSettings({ s }: { s: S }) {
  return (
    <Group title="窗口与文件">
      <Row label="启动恢复会话" desc="打开时恢复上次的项目和标签页">
        <Toggle value={s.restoreOnStartup} onChange={(v) => s.update("restoreOnStartup", v)} />
      </Row>
      <Row label="显示隐藏文件" desc="以 . 开头的文件和目录">
        <Toggle value={s.showHiddenFiles} onChange={(v) => {
          s.update("showHiddenFiles", v);
          useFileTreeStore.getState().setShowHidden(v);
        }} />
      </Row>
      <Row label="排除文件/目录" desc="逗号分隔, 不在文件树显示">
        <input className="settings__input" value={s.filesExclude} onChange={(e) => s.update("filesExclude", e.target.value)} placeholder="node_modules, dist" />
      </Row>
    </Group>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-content__group">
      <div className="settings-content__group-title">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="settings-content__row">
      <div className="settings-content__row-info">
        <span className="settings-content__row-label">{label}</span>
        {desc && <span className="settings-content__row-desc">{desc}</span>}
      </div>
      <div className="settings-content__row-control">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`settings__toggle ${value ? "settings__toggle--on" : ""}`} onClick={() => onChange(!value)} role="switch" aria-checked={value}>
      <span className="settings__toggle-thumb" />
    </button>
  );
}

function LspSettings() {
  const { servers, detected, detect } = useLspStore();

  useEffect(() => {
    if (!detected) detect();
  }, [detected, detect]);

  return (
    <>
      <Group title="内置语言能力">
        <Row label="TypeScript / JavaScript" desc="补全、诊断、hover、跳转(Monaco 内置)">
          <span style={{ color: "var(--fg-success)", fontSize: "var(--fs-sm)" }}>✓ 已启用</span>
        </Row>
        <Row label="JSON / CSS / HTML / SQL" desc="基础补全和校验(Monaco 内置)">
          <span style={{ color: "var(--fg-success)", fontSize: "var(--fs-sm)" }}>✓ 已启用</span>
        </Row>
      </Group>
      <Group title="外部 Language Server">
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: "var(--space-2)" }}>
          探测系统中已安装的 LSP server, 有则启用对应语言的代码智能。
        </div>
        {servers.map((srv) => (
          <Row
            key={srv.language}
            label={`${srv.language.toUpperCase()} (${srv.command})`}
            desc={srv.version || (srv.installed ? "已安装" : "未安装")}
          >
            {srv.installed ? (
              <span style={{ color: "var(--fg-success)", fontSize: "var(--fs-sm)" }}>✓ 可用</span>
            ) : (
              <span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>未安装</span>
            )}
          </Row>
        ))}
      </Group>
    </>
  );
}
