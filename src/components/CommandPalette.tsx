import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileText, MessageCircle, Moon, Plus, Search, Settings, Sun, Upload, Languages } from "lucide-react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { newChatAction } from "./Sidebar";

interface Action { label: string; icon: React.ReactNode; hint?: string; run: () => void }

/** Opened by keyboard dozens of times a day, so it has no open or close animation. */
export function CommandPalette() {
  const { t } = useT();
  const open = useUi((s) => s.cmdOpen);
  const docNames = useUi((s) => s.docNames);
  const set = useUi((s) => s.set);
  const { chats, setActive, theme, setTheme, lang, setLang } = useStore();
  const dlg = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) { setQ(""); setSel(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const actions = useMemo<Action[]>(() => [
    { label: t("a_new"), icon: <Plus size={18} />, hint: "⌘ J", run: newChatAction },
    { label: t("a_files"), icon: <FileText size={18} />, run: () => set({ view: "files", panel: null }) },
    { label: t("a_chat"), icon: <MessageCircle size={18} />, run: () => set({ view: "chat", panel: null }) },
    { label: t("a_upload"), icon: <Upload size={18} />, run: () => set({ view: "files", panel: null }) },
    { label: t("a_theme"), icon: theme === "dark" ? <Sun size={18} /> : <Moon size={18} />, run: () => setTheme(theme === "dark" ? "light" : "dark") },
    { label: t("a_lang"), icon: <Languages size={18} />, hint: "EN / עב", run: () => setLang(lang === "he" ? "en" : "he") },
    { label: t("a_settings"), icon: <Settings size={18} />, run: () => set({ settingsOpen: true }) },
    ...chats.filter((c) => c.messages.length).slice(0, 20).map((c): Action => ({ label: c.title || t("untitled"), icon: <MessageCircle size={18} />, hint: t("navChat"), run: () => { setActive(c.id); set({ view: "chat", panel: null }); } })),
    ...Object.values(docNames).slice(0, 30).map((d): Action => ({ label: t("a_open", { name: d.name }), icon: <Eye size={18} />, hint: d.suffix?.toUpperCase(), run: () => set({ viewer: { docId: d.id, from: "files" } }) })),
  ], [t, chats, docNames, theme, lang, set, setActive, setTheme, setLang]);

  const shown = useMemo(() => actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())), [actions, q]);
  const run = (i: number) => { const a = shown[i]; if (!a) return; set({ cmdOpen: false }); a.run(); };

  return (
    <dialog ref={dlg} onClose={() => set({ cmdOpen: false })} onClick={(e) => e.target === dlg.current && set({ cmdOpen: false })}
      aria-label={t("cmdAria")} className="glass m-0 mx-auto mt-[14vh] w-[min(580px,calc(100vw-32px))] overflow-hidden rounded-xl border-0 bg-transparent p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-[6px]">
      <div className="flex h-[58px] items-center gap-3 border-b border-line px-5 text-ink3">
        <Search size={18} />
        <input value={q} aria-label={t("cmdPh")} placeholder={t("cmdPh")} autoFocus
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, shown.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); run(sel); }
          }}
          className="flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink3" />
      </div>
      <div className="max-h-[340px] overflow-y-auto p-2" role="listbox">
        {shown.length === 0 && <p className="p-[18px] text-ink3">{t("noRes")}</p>}
        {shown.map((a, i) => (
          <button key={i} role="option" aria-selected={i === sel} onClick={() => run(i)} onMouseMove={() => setSel(i)}
            className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start font-medium", i === sel ? "bg-wash2 text-ink" : "text-ink2")}>
            {a.icon}<bdi className="truncate">{a.label}</bdi>
            {a.hint && <span dir="ltr" className="ms-auto font-mono text-[11px] text-ink3">{a.hint}</span>}
          </button>
        ))}
      </div>
    </dialog>
  );
}
