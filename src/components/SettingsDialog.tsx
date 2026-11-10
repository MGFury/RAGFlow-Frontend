import { useEffect, useRef, useState } from "react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { ensureResources, testConnection } from "@/lib/ragflow";
import { notifyDocsChanged } from "@/hooks";
import { Btn } from "./ui";

export function SettingsDialog() {
  const { t, lang } = useT();
  const open = useUi((s) => s.settingsOpen);
  const set = useUi((s) => s.set);
  const saved = useStore();
  const dlg = useRef<HTMLDialogElement>(null);
  const [baseUrl, setBase] = useState(saved.baseUrl);
  const [apiKey, setKey] = useState(saved.apiKey);
  const [datasetId, setDs] = useState(saved.datasetId);
  const [chatId, setChat] = useState(saved.chatId);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({ kind: "idle" });

  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) { setBase(saved.baseUrl); setKey(saved.apiKey); setDs(saved.datasetId); setChat(saved.chatId); setState({ kind: "idle" }); d.showModal(); }
    if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const connect = async () => {
    setState({ kind: "busy" });
    saved.setSettings({ baseUrl: baseUrl.trim() || "/ragflow", apiKey: apiKey.trim(), datasetId: datasetId.trim(), chatId: chatId.trim() });
    try {
      await testConnection();
      await ensureResources(lang);
      setState({ kind: "ok", msg: t("connected") });
      notifyDocsChanged();
      setTimeout(() => set({ settingsOpen: false }), 700);
    } catch (e) {
      setState({ kind: "err", msg: t("connectFail", { msg: (e as Error).message }) });
    }
  };

  const field = "h-11 w-full rounded-md bg-surface px-3.5 text-ink shadow-[inset_0_0_0_1px_var(--line)] outline-none placeholder:text-ink3 focus:shadow-[inset_0_0_0_1.5px_var(--accent-ring)]";
  return (
    <dialog ref={dlg} onClose={() => set({ settingsOpen: false })} onCancel={(e) => { if (!saved.apiKey) e.preventDefault(); }}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-xl border-0 bg-canvas2 p-0 text-ink shadow-[var(--shadow-float),inset_0_0_0_1px_var(--line-strong)] backdrop:bg-black/45 backdrop:backdrop-blur-[6px]">
      <form className="grid gap-4 p-6" onSubmit={(e) => { e.preventDefault(); void connect(); }}>
        <div>
          <h2 className="text-xl font-bold">{t("setT")}</h2>
          <p className="mt-1 text-ink2">{t("setS")}</p>
        </div>
        <label className="grid gap-1.5"><span className="font-semibold">{t("baseUrl")}</span>
          <input className={field} dir="ltr" value={baseUrl} onChange={(e) => setBase(e.target.value)} placeholder="/ragflow" />
          <small className="text-ink3">{t("baseUrlHint")}</small></label>
        <label className="grid gap-1.5"><span className="font-semibold">{t("apiKey")}</span>
          <input className={field} dir="ltr" type="password" autoComplete="off" value={apiKey} onChange={(e) => setKey(e.target.value)} placeholder="ragflow-…" />
          <small className="text-ink3">{t("apiKeyHint")}</small></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">{t("datasetId")}</span><input className={field} dir="ltr" value={datasetId} onChange={(e) => setDs(e.target.value)} /></label>
          <label className="grid gap-1.5"><span className="text-[13px] font-semibold">{t("chatId")}</span><input className={field} dir="ltr" value={chatId} onChange={(e) => setChat(e.target.value)} /></label>
          <small className="text-ink3 sm:col-span-2">{t("autoHint")}</small>
        </div>
        {state.msg && <p role="status" className={state.kind === "err" ? "text-danger" : "text-accent"}>{state.msg}</p>}
        <div className="flex justify-end gap-2">
          {saved.apiKey && <Btn variant="ghost" onClick={() => set({ settingsOpen: false })}>{t("cancel")}</Btn>}
          <Btn variant="primary" type="submit" disabled={!apiKey.trim() || state.kind === "busy"}>{state.kind === "busy" ? t("connecting") : t("connect")}</Btn>
        </div>
      </form>
    </dialog>
  );
}
