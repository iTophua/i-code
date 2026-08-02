import { useEffect, useState } from "react";
import { useNotesStore, noteDisplayTitle, type Note } from "../stores/notesStore";
import { useEditorStore } from "../stores/editorStore";
import { useLayoutStore } from "../stores/layoutStore";
import { CloseIcon } from "./Icons";
import { ConfirmDialog } from "./ConfirmDialog";
import "../styles/notes.css";

export function NotesPanel() {
  const {
    notes,
    search,
    loading,
    loadNotes,
    createNote,
    deleteNote,
    togglePin,
    setSearch,
  } = useNotesStore();
  const openNote = useEditorStore((s) => s.openNote);
  const closeTab = useEditorStore((s) => s.closeTab);
  const workspaceRoot = useLayoutStore((s) => s.workspaceRoot);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  // 加载便签(项目切换时)
  useEffect(() => {
    loadNotes(workspaceRoot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  // 过滤
  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  // 点击便签 → 在主编辑区打开(tab 名用显示标题: 自定义标题优先, 否则第一行)
  const handleOpen = (note: Note) => {
    openNote({
      id: note.id,
      title: note.title,
      content: note.content,
      language: note.language,
    });
    // 同步 tab 显示名
    useEditorStore.setState((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === `note:${note.id}` ? { ...t, name: noteDisplayTitle(note) } : t
      ),
    }));
  };

  // 新建便签 → 创建后立即打开
  const handleCreate = async () => {
    setCreating(true);
    await createNote(workspaceRoot);
    setCreating(false);
    // 打开新建的便签(loadNotes 后 notes 已更新, 取第一条即最新)
    const latest = useNotesStore.getState().notes[0];
    if (latest) handleOpen(latest);
  };

  return (
    <div className="notes">
      {/* 工具栏 */}
      <div className="notes__header">
        <span
          className="notes__title"
          title="双击新建便签"
          onDoubleClick={() => handleCreate()}
        >
          便签
        </span>
        <button
          className="icon-btn"
          title="新建便签"
          onClick={handleCreate}
          disabled={creating}
        >
          +
        </button>
      </div>

      {/* 搜索 */}
      <div className="notes__search">
        <input
          type="text"
          placeholder="搜索便签..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 列表(纯列表, 编辑在主区) */}
      <div className="notes__list">
        {loading ? (
          <div className="notes__empty">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="notes__empty">
            {notes.length === 0 ? "暂无便签，点 + 新建" : "无匹配结果"}
          </div>
        ) : (
          filtered.map((note) => {
            const tabId = `note:${note.id}`;
            const isActive = activeTabId === tabId;
            return (
              <NoteRow
                key={note.id}
                note={note}
                active={isActive}
                onClick={() => handleOpen(note)}
                onTogglePin={() => togglePin(note.id)}
                onDelete={() => setDeleteTarget(note)}
              />
            );
          })
        )}
      </div>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除便签"
        message={
          deleteTarget
            ? `确定要删除便签 "${
                deleteTarget.title || "无标题"
              }" 吗？\n此操作不可恢复。`
            : ""
        }
        confirmLabel="删除"
        danger
        onConfirm={() => {
          if (deleteTarget) {
            // 先关掉对应的编辑 Tab(若开着)
            closeTab(`note:${deleteTarget.id}`);
            deleteNote(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function NoteRow({
  note,
  active,
  onClick,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const displayTitle = noteDisplayTitle(note);
  // 预览: 内容去掉首行(已用作标题), 截断
  const preview = (note.content || "")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(1) // 跳过首行
    .join(" ")
    .slice(0, 50);
  const isUntitled = displayTitle === "无标题便签";
  return (
    <div
      className={`note-row ${active ? "note-row--active" : ""}`}
      onClick={onClick}
    >
      <button
        className={`note-row__pin ${note.pinned ? "note-row__pin--on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        title={note.pinned ? "取消置顶" : "置顶"}
      >
        📌
      </button>
      <div className="note-row__content">
        <div className="note-row__preview">
          {isUntitled ? (
            <span className="note-row__untitled">{displayTitle}</span>
          ) : (
            displayTitle
          )}
        </div>
        {preview && <div className="note-row__sub">{preview}</div>}
        <div className="note-row__meta">{formatTime(note.updated_at)}</div>
      </div>
      <button
        className="note-row__delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (d.toDateString() === now.toDateString())
    return `今天 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
