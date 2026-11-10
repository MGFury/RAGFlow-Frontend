import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, Msg, RFDoc, UploadItem } from "@/lib/types";

export type Lang = "he" | "en";
export type Theme = "dark" | "light";
export type View = "chat" | "files" | "doc";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const newId = uid;

interface Persisted {
  baseUrl: string;
  apiKey: string;
  datasetId: string;
  chatId: string;
  lang: Lang;
  theme: Theme;
  chats: Chat[];
  activeChatId: string | null;
  /** Document ids that already carry the `file_id` metadata used for per-chat file selection. */
  tagged: string[];
}

interface Actions {
  setSettings: (p: Partial<Pick<Persisted, "baseUrl" | "apiKey" | "datasetId" | "chatId">>) => void;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  newChat: () => string;
  setActive: (id: string) => void;
  deleteChat: (id: string) => void;
  patchChat: (id: string, fn: (c: Chat) => Chat) => void;
  addMessages: (id: string, ...m: Msg[]) => void;
  markTagged: (ids: string[]) => void;
}

export const useStore = create<Persisted & Actions>()(
  persist(
    (set, get) => ({
      baseUrl: "/ragflow",
      apiKey: "",
      datasetId: "",
      chatId: "",
      lang: "he",
      theme: matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
      chats: [],
      activeChatId: null,
      tagged: [],
      setSettings: (p) => set(p),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      newChat: () => {
        const id = uid();
        const chat: Chat = { id, title: "", createdAt: Date.now(), scope: null, messages: [] };
        // Empty chats are dropped so "New chat" never piles up blanks.
        set((s) => ({ chats: [chat, ...s.chats.filter((c) => c.messages.length > 0)], activeChatId: id }));
        return id;
      },
      setActive: (id) => set({ activeChatId: id }),
      deleteChat: (id) =>
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          return { chats, activeChatId: s.activeChatId === id ? (chats[0]?.id ?? null) : s.activeChatId };
        }),
      patchChat: (id, fn) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? fn(c) : c)) })),
      addMessages: (id, ...m) => get().patchChat(id, (c) => ({ ...c, messages: [...c.messages, ...m] })),
      markTagged: (ids) => set((s) => ({ tagged: Array.from(new Set([...s.tagged, ...ids])) })),
    }),
    { name: "shaul", version: 1 },
  ),
);

/** Transient UI state: nothing here is persisted. */
interface Ui {
  view: View;
  /** Source panel: a document, optionally with the passages a chat answer used from it. */
  panel: { docId: string; from: "chat" | "files"; msgId?: string } | null;
  viewer: { docId: string; page?: number; highlight?: number[][]; from: "chat" | "files" } | null;
  navOpen: boolean;
  cmdOpen: boolean;
  settingsOpen: boolean;
  toast: string | null;
  uploads: UploadItem[];
  /** Streaming assistant message for the active chat, kept out of persistence until it completes. */
  streaming: { chatId: string; text: string } | null;
  docNames: Record<string, RFDoc>;
  set: (p: Partial<Omit<Ui, "set" | "flash">>) => void;
  flash: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useUi = create<Ui>((set) => ({
  view: "chat",
  panel: null,
  viewer: null,
  navOpen: false,
  cmdOpen: false,
  settingsOpen: false,
  toast: null,
  uploads: [],
  streaming: null,
  docNames: {},
  set: (p) => set(p),
  flash: (msg) => {
    set({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },
}));
