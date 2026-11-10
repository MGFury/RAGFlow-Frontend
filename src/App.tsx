import { lazy, Suspense, useEffect } from "react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Sidebar, newChatAction } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { FilesView } from "./components/FilesView";
import { SourcePanel } from "./components/SourcePanel";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDialog } from "./components/SettingsDialog";

const Viewer = lazy(() => import("./components/Viewer")); // pdf.js and friends load only when a file is opened

export default function App() {
  const { t } = useT();
  const { view, panel, viewer, toast, set } = useUi();
  const theme = useStore((s) => s.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // First run: ask for the RAGFlow connection.
  useEffect(() => { if (!useStore.getState().apiKey) set({ settingsOpen: true }); }, [set]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); set({ cmdOpen: !useUi.getState().cmdOpen }); }
      else if (mod && e.key.toLowerCase() === "j") { e.preventDefault(); newChatAction(); }
      else if (e.key === "Escape") {
        const s = useUi.getState();
        if (s.cmdOpen || s.settingsOpen) return;
        if (s.viewer) set({ viewer: null }); else if (s.panel) set({ panel: null });
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [set]);

  return (
    <>
      <div className={cn(
        "grid h-dvh grid-cols-[264px_minmax(0,1fr)] gap-2.5 p-2.5 max-[900px]:grid-cols-1 max-[900px]:gap-0 max-[900px]:p-0",
        panel && "min-[1221px]:grid-cols-[264px_minmax(0,1fr)_400px]",
      )}>
        <Sidebar />
        <main className="relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-canvas shadow-[inset_0_0_0_1px_var(--line),0_20px_50px_-20px_rgba(0,0,0,0.5)] max-[900px]:rounded-none max-[900px]:shadow-none">
          {view === "files" ? <FilesView /> : <ChatView />}
          {viewer && <Suspense fallback={null}><Viewer key={viewer.docId} /></Suspense>}
        </main>
        {panel && !viewer && <SourcePanel />}

        <nav className="glass fixed inset-x-3.5 bottom-[calc(10px+env(safe-area-inset-bottom))] z-20 hidden h-[62px] grid-cols-2 gap-1 rounded-[31px] p-1.5 max-[900px]:grid" aria-label="Sections">
          {(["chat", "files"] as const).map((v) => (
            <button key={v} onClick={() => set({ view: v, panel: null, viewer: null })} aria-current={(v === "files") === (view === "files") ? "page" : undefined}
              className={cn("press flex flex-col items-center justify-center rounded-[26px] text-[11px] font-semibold", (v === "files") === (view === "files") ? "bg-white/10 text-ink light:bg-white/90" : "text-ink2")}>
              {t(v === "chat" ? "navChat" : "navFiles")}
            </button>
          ))}
        </nav>
      </div>
      <CommandPalette />
      <SettingsDialog />
      <div role="status" className={cn("glass pointer-events-none fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-full px-[18px] py-[11px] text-[13px] font-medium transition duration-200 ease-out-strong", toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>{toast}</div>
    </>
  );
}
