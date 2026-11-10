import { useEffect, useMemo, useState } from "react";
import { FileText, MessageCircle, Moon, Plus, Settings, Sun, Trash2 } from "lucide-react";
import { useStore, useUi } from "@/store";
import { useT, type Key } from "@/i18n";
import { cn } from "@/lib/utils";
import { IconBtn } from "./ui";
import { listDocuments } from "@/lib/ragflow";
import { DOCS_CHANGED } from "@/hooks";
import type { Chat } from "@/lib/types";

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8.6" fill="none" stroke="var(--text)" strokeWidth="1.8" />
      <circle cx="11" cy="11" r="3.2" fill="var(--acid)" />
    </svg>
  );
}

export function newChatAction() {
  useStore.getState().newChat();
  useUi.getState().set({ view: "chat", navOpen: false, panel: null });
}

function group(chats: Chat[]): [Key, Chat[]][] {
  const start = new Date().setHours(0, 0, 0, 0);
  const g: Record<string, Chat[]> = { today: [], yesterday: [], earlier: [] };
  for (const c of chats) {
    if (!c.messages.length) continue;
    (c.createdAt >= start ? g.today : c.createdAt >= start - 864e5 ? g.yesterday : g.earlier).push(c);
  }
  return ([["today", g.today], ["yesterday", g.yesterday], ["earlier", g.earlier]] as [Key, Chat[]][]).filter(([, l]) => l.length);
}

export function Sidebar() {
  const { t, lang } = useT();
  const { view, navOpen, set } = useUi();
  const { chats, activeChatId, setActive, deleteChat, theme, setTheme, setLang } = useStore();
  const ready = useStore((s) => !!(s.apiKey && s.datasetId));
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    const load = () => listDocuments({ page: 1, pageSize: 1 }).then((r) => setCount(r.total)).catch(() => {});
    load();
    window.addEventListener(DOCS_CHANGED, load);
    return () => window.removeEventListener(DOCS_CHANGED, load);
  }, [ready]);

  const groups = useMemo(() => group(chats), [chats]);
  const go = (v: "chat" | "files") => set({ view: v, navOpen: false, panel: null });

  const navBtn = (v: "chat" | "files", icon: React.ReactNode, label: string, extra?: React.ReactNode) => {
    const on = v === "files" ? view === "files" : view !== "files";
    return (
      <button type="button" aria-current={on ? "page" : undefined} onClick={() => go(v)}
        className={cn("press flex h-10 items-center gap-3 rounded-md px-3 text-start font-medium", on ? "bg-white/[0.09] text-ink light:bg-white" : "text-ink2 [@media(hover:hover)]:hover:bg-white/5 [@media(hover:hover)]:hover:text-ink")}>
        <span className={on ? "text-ink" : "text-ink3"}>{icon}</span>
        {label}
        {extra}
      </button>
    );
  };

  return (
    <>
      <aside className={cn(
        "flex min-h-0 flex-col rounded-xl bg-canvas2 p-3 pt-4 shadow-[inset_0_0_0_1px_var(--line)]",
        "max-[900px]:fixed max-[900px]:inset-y-2 max-[900px]:start-2 max-[900px]:z-40 max-[900px]:w-[min(300px,86vw)] max-[900px]:transition-transform max-[900px]:duration-300 max-[900px]:ease-sheet",
        navOpen ? "max-[900px]:translate-x-0" : "max-[900px]:-translate-x-[110%] rtl:max-[900px]:translate-x-[110%]",
      )}>
        <div className="flex items-center gap-2.5 px-2 pb-4 text-[19px] font-bold"><BrandMark />{t("brand")}</div>
        <button type="button" onClick={newChatAction}
          className="press mb-3.5 flex h-10 items-center gap-2 rounded-md bg-white/[0.06] px-4 text-[13.5px] font-semibold shadow-[inset_0_0_0_1px_var(--line)] light:bg-white/70 [@media(hover:hover)]:hover:bg-surface">
          <Plus size={18} />{t("newChat")}
          <kbd dir="ltr" className="ms-auto rounded-md px-1.5 py-px font-mono text-[11px] text-ink3 shadow-[inset_0_0_0_1px_var(--line-strong)]">⌘ J</kbd>
        </button>
        <nav className="mb-4 grid gap-0.5">
          {navBtn("chat", <MessageCircle size={18} />, t("navChat"))}
          {navBtn("files", <FileText size={18} />, t("navFiles"), count !== null && <span className="ms-auto font-mono text-[11.5px] text-ink3">{count}</span>)}
        </nav>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {groups.map(([k, list]) => (
            <div key={k}>
              <h3 className="mt-4 mb-1.5 px-3 text-xs font-semibold text-ink3 first:mt-0">{t(k)}</h3>
              {list.map((c) => (
                <div key={c.id} className="group relative">
                  <button type="button" aria-current={c.id === activeChatId && view !== "files"} onClick={() => { setActive(c.id); set({ view: "chat", navOpen: false, panel: null }); }}
                    className={cn("press block w-full truncate rounded-[10px] px-3 py-2 pe-9 text-start text-[13.5px]", c.id === activeChatId && view !== "files" ? "bg-white/[0.07] text-ink light:bg-white/80" : "text-ink2 [@media(hover:hover)]:hover:bg-white/5 [@media(hover:hover)]:hover:text-ink")}>
                    {c.title || t("untitled")}
                  </button>
                  <IconBtn aria-label={t("deleteChat")} onClick={() => deleteChat(c.id)} className="absolute end-0.5 top-0.5 size-8 opacity-0 transition-opacity group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 max-[900px]:opacity-100">
                    <Trash2 size={15} />
                  </IconBtn>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1 border-t border-line px-1.5 pt-2.5">
          <IconBtn aria-label={t("settings")} onClick={() => set({ settingsOpen: true, navOpen: false })}><Settings size={18} /></IconBtn>
          <span className="flex-1" />
          <IconBtn aria-label={t("langAria")} className="w-auto min-w-9 px-2.5 text-xs font-bold" onClick={() => setLang(lang === "he" ? "en" : "he")}>{t("langBtn")}</IconBtn>
          <IconBtn aria-label={t(theme === "dark" ? "toLight" : "toDark")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</IconBtn>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-[35] hidden bg-black/45 max-[900px]:block" onClick={() => set({ navOpen: false })} />}
    </>
  );
}
