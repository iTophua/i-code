import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";

/**
 * 便签列表状态
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  language: string;
  pinned: number; // 0/1
  project_scope: string | null;
  created_at: number;
  updated_at: number;
}

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:i-code.db");
  }
  return dbPromise;
}

interface NotesStore {
  notes: Note[];
  activeId: string | null;
  search: string;
  loading: boolean;

  loadNotes: (projectScope: string | null) => Promise<void>;
  createNote: (projectScope: string | null) => Promise<void>;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content" | "language" | "pinned">>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  setSearch: (s: string) => void;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  activeId: null,
  search: "",
  loading: false,

  loadNotes: async (projectScope) => {
    set({ loading: true });
    try {
      const db = await getDb();
      const rows = await db.select<Note[]>(
        `SELECT * FROM notes WHERE project_scope IS ? ORDER BY pinned DESC, updated_at DESC`,
        [projectScope]
      );
      set({ notes: rows, loading: false });
      // 默认选第一条
      if (rows.length > 0 && !get().activeId) {
        set({ activeId: rows[0].id });
      }
    } catch (e) {
      console.error("加载便签失败:", e);
      set({ loading: false });
    }
  },

  createNote: async (projectScope) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    try {
      const db = await getDb();
      await db.execute(
        `INSERT INTO notes (id, title, content, language, pinned, project_scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, "", "", "plaintext", 0, projectScope, now, now]
      );
      await get().loadNotes(projectScope);
      set({ activeId: id });
    } catch (e) {
      console.error("新建便签失败:", e);
    }
  },

  updateNote: async (id, patch) => {
    const now = Date.now();
    try {
      const db = await getDb();
      const sets: string[] = [];
      const vals: (string | number)[] = [];
      if (patch.title !== undefined) {
        sets.push("title = ?");
        vals.push(patch.title);
      }
      if (patch.content !== undefined) {
        sets.push("content = ?");
        vals.push(patch.content);
      }
      if (patch.language !== undefined) {
        sets.push("language = ?");
        vals.push(patch.language);
      }
      if (patch.pinned !== undefined) {
        sets.push("pinned = ?");
        vals.push(patch.pinned);
      }
      sets.push("updated_at = ?");
      vals.push(now);
      vals.push(id);
      await db.execute(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`, vals);

      // 本地更新
      set((s) => ({
        notes: s.notes.map((n) =>
          n.id === id ? { ...n, ...patch, updated_at: now } : n
        ),
      }));
    } catch (e) {
      console.error("更新便签失败:", e);
    }
  },

  deleteNote: async (id) => {
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM notes WHERE id = ?`, [id]);
      const { notes, activeId } = get();
      const newNotes = notes.filter((n) => n.id !== id);
      set({
        notes: newNotes,
        activeId: activeId === id ? newNotes[0]?.id ?? null : activeId,
      });
    } catch (e) {
      console.error("删除便签失败:", e);
    }
  },

  togglePin: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await get().updateNote(id, { pinned: note.pinned ? 0 : 1 });
    // 重新排序
    const { notes } = get();
    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      return b.updated_at - a.updated_at;
    });
    set({ notes: [...notes] });
  },

  setActive: (id) => set({ activeId: id }),
  setSearch: (s) => set({ search: s }),
}));
