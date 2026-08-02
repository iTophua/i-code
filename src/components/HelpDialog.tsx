import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLayoutStore } from "../stores/layoutStore";
import "./ui/radix-theme.css";
import "../styles/help.css";

interface ShortcutGroup {
  title: string;
  items: { keys: string; desc: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "文件 / 项目",
    items: [
      { keys: "Cmd+O", desc: "打开文件夹" },
      { keys: "Cmd+W", desc: "关闭当前标签" },
      { keys: "Cmd+Shift+T", desc: "恢复最近关闭的标签" },
      { keys: "Cmd+S", desc: "保存当前文件 / 便签" },
    ],
  },
  {
    title: "视图 / 布局",
    items: [
      { keys: "Cmd+B", desc: "切换侧栏显示 / 隐藏" },
      { keys: "Cmd+Shift+P", desc: "打开命令面板" },
      { keys: "Cmd+Shift+F", desc: "全局搜索" },
      { keys: "Cmd+,", desc: "打开设置" },
      { keys: "Cmd+\\", desc: "切换分屏" },
      { keys: "Cmd+Shift+Z", desc: "Zen 模式（全屏无干扰）" },
      { keys: "Ctrl+`", desc: "切换底部终端面板" },
    ],
  },
  {
    title: "编辑",
    items: [
      { keys: "Cmd+D", desc: "选中下一个匹配项" },
      { keys: "Cmd+Shift+L", desc: "选中所有匹配项" },
      { keys: "Cmd+点击", desc: "在任意位置添加光标" },
      { keys: "Option+拖拽", desc: "矩形列选（块编辑）" },
      { keys: "Cmd+Option+↑/↓", desc: "上 / 下添加光标" },
      { keys: "Cmd+U", desc: "撤销上次光标操作" },
      { keys: "Cmd+Shift+V", desc: "Markdown 预览模式切换" },
    ],
  },
];

interface GuideSection {
  title: string;
  body: React.ReactNode;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "文件树 & 分支切换",
    body: (
      <ul>
        <li>单击文件预览，双击或编辑后固定为正式标签</li>
        <li>右键文件 / 文件夹：新建、重命名、删除、复制、查看历史、Blame 等</li>
        <li>项目名右侧显示当前 Git 分支，点击可快速切换或新建分支</li>
        <li>文件夹按名称着色（src 蓝、components 黄等），被 Git 忽略的文件显示灰色</li>
        <li>右键标签：关闭 / 关闭左侧 / 关闭右侧 / 关闭其他 / 关闭全部 / 分屏打开</li>
      </ul>
    ),
  },
  {
    title: "便签",
    body: (
      <ul>
        <li>侧栏便签图标<b>双击</b>快速新建便签</li>
        <li>便签标题默认取内容第一行，也可手动输入自定义标题</li>
        <li>切换语言（JSON / SQL 等）后顶部出现快捷工具（格式化 / 压缩）</li>
        <li>便签编辑后显示未保存标记，Cmd+S 保存到本地数据库</li>
        <li>便签内容自动暂存为草稿，重启后恢复</li>
      </ul>
    ),
  },
  {
    title: "工具",
    body: (
      <ul>
        <li>侧栏点击工具（JSON / SQL / 编解码 / 开发工具 / 文本对比）在主区域以独立标签打开</li>
        <li>每个工具一个标签，互不干扰</li>
        <li>切换侧栏菜单时，标签栏只显示对应功能的标签</li>
      </ul>
    ),
  },
  {
    title: "分屏编辑",
    body: (
      <ul>
        <li>右键标签 →「分屏打开（左右）」或「分屏打开（上下）」</li>
        <li>分屏后每个编辑区有独立的标签栏</li>
        <li>分屏标签栏右侧 × 按钮关闭分屏</li>
      </ul>
    ),
  },
  {
    title: "设置",
    body: (
      <ul>
        <li>Cmd+, 或点击标题栏设置图标打开设置弹窗</li>
        <li>设置弹窗记忆上次选择的分类</li>
        <li>主题、编辑器、终端、窗口、代码智能 五个分类</li>
      </ul>
    ),
  },
];

export function HelpDialog() {
  const open = useLayoutStore((s) => s.helpOpen);
  const setOpen = useLayoutStore((s) => s.setHelpOpen);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => setOpen(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-overlay" />
        <Dialog.Content className="help-dialog">
          <Dialog.Title className="help-dialog__title">
            使用帮助
          </Dialog.Title>
          <button
            className="app-dialog-close"
            onClick={() => setOpen(false)}
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} strokeWidth={1.75} />
          </button>

          <div className="help-dialog__body">
            {/* 使用教程 */}
            <div className="help-dialog__section">
              <h3 className="help-dialog__section-title">使用教程</h3>
              <div className="help-dialog__guides">
                {GUIDE_SECTIONS.map((g) => (
                  <div key={g.title} className="help-dialog__guide">
                    <div className="help-dialog__guide-title">{g.title}</div>
                    <div className="help-dialog__guide-body">{g.body}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 快捷键 */}
            <div className="help-dialog__section">
              <h3 className="help-dialog__section-title">快捷键</h3>
              <div className="help-dialog__shortcuts">
                {SHORTCUT_GROUPS.map((group) => (
                  <div key={group.title} className="help-dialog__shortcut-group">
                    <div className="help-dialog__shortcut-group-title">{group.title}</div>
                    {group.items.map((item) => (
                      <div key={item.keys} className="help-dialog__shortcut-row">
                        <kbd className="help-dialog__kbd">{item.keys}</kbd>
                        <span className="help-dialog__shortcut-desc">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
