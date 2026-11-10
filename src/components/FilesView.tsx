import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Upload } from "lucide-react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { deleteDocuments, parseDocuments, stopParsing, uploadFile, ensureResources } from "@/lib/ragflow";
import { fmtSize, lastMessage, relTime, statusKey, statusOf } from "@/lib/format";
import { notifyDocsChanged, useDebounced, useDocuments } from "@/hooks";
import type { RFDoc } from "@/lib/types";
import { TopBar } from "./TopBar";
import { Btn, Empty, FileTile, IconBtn, LinkBtn } from "./ui";

const PAGE = 30;
const RUN: Record<string, string[] | undefined> = { all: undefined, ready: ["DONE"], busy: ["UNSTART", "RUNNING", "SCHEDULE"], failed: ["FAIL", "CANCEL"] };
const COLS = "grid-cols-[minmax(0,1fr)_92px_76px_190px_210px] max-[900px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[900px]:gap-2 max-[900px]:px-3";

export function FilesView() {
  const { t, lang } = useT();
  const { panel, uploads, set, flash } = useUi();
  const configured = useStore((s) => !!s.apiKey);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<keyof typeof RUN>("all");
  const [page, setPage] = useState(1);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const kw = useDebounced(q);
  const { docs, total, loading, error, reload } = useDocuments({ page, pageSize: PAGE, keywords: kw || undefined, run: RUN[filter] });
  useEffect(() => setPage(1), [kw, filter]);

  const doUpload = async (files: File[]) => {
    if (!files.length) return;
    try { await ensureResources(useStore.getState().lang); } catch (e) { return flash(String((e as Error).message)); }
    for (const f of files) {
      const key = Math.random().toString(36).slice(2);
      const patch = (p: Partial<{ progress: number; error: string }>) => useUi.setState((s) => ({ uploads: s.uploads.map((u) => (u.key === key ? { ...u, ...p } : u)) }));
      useUi.setState((s) => ({ uploads: [{ key, name: f.name, progress: 0 }, ...s.uploads] }));
      try {
        const created = await uploadFile(f, (p) => patch({ progress: p }));
        await parseDocuments(created.map((d) => d.id)); // start processing right away
        notifyDocsChanged();
        useUi.setState((s) => ({ uploads: s.uploads.filter((u) => u.key !== key) }));
      } catch (e) {
        patch({ error: (e as Error).message });
        flash(`${t("uploadFailed")}: ${f.name}`);
        setTimeout(() => useUi.setState((s) => ({ uploads: s.uploads.filter((u) => u.key !== key) })), 5000);
      }
    }
  };

  // The whole screen is a drop target.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setOver(true); } };
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setOver(false); } };
    const drop = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setOver(false); void doUpload([...(e.dataTransfer?.files ?? [])]); };
    const prevent = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave); window.addEventListener("dragover", prevent); window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave); window.removeEventListener("dragover", prevent); window.removeEventListener("drop", drop); };
  });

  const act = async (fn: () => Promise<void>, ok?: string) => {
    try { await fn(); if (ok) flash(ok); reload(); notifyDocsChanged(); } catch (e) { flash((e as Error).message); }
  };

  const ready = docs.filter((d) => statusOf(d) === "ready").length;
  const hasNext = total !== null ? page * PAGE < total : docs.length === PAGE;

  return (
    <section className="absolute inset-0 flex min-h-0 flex-col">
      <TopBar title={t("navFiles")} />
      <div className={cn("pointer-events-none absolute inset-3 z-[6] grid place-items-center rounded-lg bg-canvas/90 opacity-0 shadow-[inset_0_0_0_2px_var(--accent-ring)] transition-opacity duration-150", over && "opacity-100")}>
        <div className="grid justify-items-center gap-1.5 text-center text-ink2"><Upload size={28} className="text-ink" /><b className="text-[17px] font-semibold text-ink">{t("dropT")}</b><span>{t("dropS")}</span></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-9 pb-12 max-[900px]:px-4 max-[900px]:pb-28">
        <div className="mx-auto max-w-[1000px]">
          <div className="pt-[92px] max-[900px]:pt-[84px]">
            <h2 className="text-4xl leading-[1.12] font-bold max-[900px]:text-[32px]">{t("navFiles")}</h2>
            <p className="mt-1.5 text-[15px] text-ink2">{total !== null ? t("filesSub", { n: total, r: ready }) : t("filesSubUnknown")}</p>
          </div>
          <div className="mt-6 mb-4 flex flex-wrap items-center gap-2.5">
            <label className="flex h-10 min-w-[180px] flex-1 items-center gap-2.5 rounded-full bg-surface px-3.5 text-ink3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--accent-ring)]">
              <Search size={16} /><span className="sr-only">{t("searchFiles")}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchFiles")} className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink3" />
            </label>
            <Seg value={filter as string} onChange={(v) => setFilter(v as keyof typeof RUN)} items={[["all", t("fAll")], ["ready", t("fReady")], ["busy", t("fBusy")], ["failed", t("fFailed")]]} />
            <Btn variant="primary" onClick={() => (configured ? input.current?.click() : set({ settingsOpen: true }))}><Upload size={16} />{t("upload")}</Btn>
            <input ref={input} type="file" multiple hidden onChange={(e) => { void doUpload([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>

          <div className="overflow-hidden rounded-lg bg-surface shadow-[inset_0_0_0_1px_var(--line)]" role="table">
            <div role="row" className={cn("grid min-h-[42px] items-center gap-4 px-[18px] text-xs font-semibold text-ink3 max-[900px]:hidden", COLS)}>
              <span>{t("colName")}</span><span>{t("colSize")}</span><span>{t("colChunks")}</span><span>{t("colStatus")}</span><span />
            </div>
            {uploads.map((u) => (
              <div key={u.key} role="row" className={cn("grid min-h-[62px] items-center gap-4 border-t border-line px-[18px]", COLS)}>
                <div className="flex min-w-0 items-center gap-3.5"><FileTile suffix={u.name.split(".").pop()} /><span className="truncate font-medium"><bdi>{u.name}</bdi></span></div>
                <span className="max-[900px]:hidden" /><span className="max-[900px]:hidden" />
                <div className="flex items-center gap-2.5 text-[13px] text-ink2">
                  {u.error ? <span className="text-danger">{u.error}</span> : (<><span className="h-[5px] w-[90px] overflow-hidden rounded bg-line2"><i className="block h-full origin-left rtl:origin-right bg-acid transition-transform duration-300" style={{ transform: `scaleX(${u.progress})` }} /></span>{t("st_uploading")}</>)}
                </div>
                <span className="max-[900px]:hidden" />
              </div>
            ))}
            {loading && !docs.length && <Empty title="…" />}
            {error && <Empty title={t("errGeneric")}>{error}<br /><LinkBtn onClick={reload}>{t("retry")}</LinkBtn></Empty>}
            {!loading && !error && !docs.length && !uploads.length && (configured ? (kw || filter !== "all" ? <Empty title={t("noMatch")} /> : <Empty title={t("emptyFiles")}>{t("emptyFilesS")}</Empty>) : <Empty title={t("errNoSetup")}><LinkBtn onClick={() => set({ settingsOpen: true })}>{t("settings")}</LinkBtn></Empty>)}
            {docs.map((d) => <Row key={d.id} d={d} active={panel?.docId === d.id} lang={lang} act={act} />)}
          </div>

          {(page > 1 || hasNext) && (
            <div className="mt-4 flex items-center justify-center gap-3 text-[13px] text-ink2">
              <IconBtn aria-label={t("prevPageList")} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronRight size={18} className="ltr:rotate-180" /></IconBtn>
              <span className="font-mono">{t("range", { a: (page - 1) * PAGE + 1, b: (page - 1) * PAGE + docs.length })}</span>
              <IconBtn aria-label={t("nextPageList")} disabled={!hasNext} onClick={() => setPage((p) => p + 1)}><ChevronLeft size={18} className="ltr:rotate-180" /></IconBtn>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ d, active, lang, act }: { d: RFDoc; active: boolean; lang: string; act: (fn: () => Promise<void>, ok?: string) => void }) {
  const { t } = useT();
  const set = useUi((s) => s.set);
  const [confirm, setConfirm] = useState(false);
  const st = statusOf(d);
  const busy = st === "parsing" || st === "queued";
  const reason = st === "failed" ? lastMessage(d) : "";
  return (
    <div role="row" tabIndex={0} aria-current={active} onClick={() => set({ panel: { docId: d.id, from: "files" } })}
      onDoubleClick={() => set({ viewer: { docId: d.id, from: "files" } })}
      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) set({ panel: { docId: d.id, from: "files" } }); }}
      className={cn("group grid min-h-[62px] cursor-pointer items-center gap-4 border-t border-line px-[18px] text-start transition-colors", COLS, active ? "bg-wash" : "[@media(hover:hover)]:hover:bg-surface2")}>
      <div className="flex min-w-0 items-center gap-3.5">
        <FileTile suffix={d.suffix} />
        <div className="min-w-0">
          <span className="block truncate font-medium"><bdi>{d.name}</bdi></span>
          <small className="block truncate text-xs text-ink3">{reason || t("updated", { when: relTime(d.update_time ?? d.create_time, t, lang) })}</small>
        </div>
      </div>
      <span className="font-mono text-[12.5px] text-ink2 max-[900px]:hidden">{fmtSize(d.size)}</span>
      <span className="font-mono text-[12.5px] text-ink2 max-[900px]:hidden">{d.chunk_count || "–"}</span>
      <div className={cn("flex min-w-0 items-center gap-2.5 text-[13px]", st === "failed" ? "text-danger" : st === "ready" ? "text-ink" : "text-ink2")}>
        <span className={cn("size-2 flex-none rounded-full", st === "ready" ? "bg-acid" : st === "failed" ? "bg-danger" : st === "parsing" ? "animate-pulse-soft bg-ink2" : "bg-ink3")} />
        {st === "parsing" ? (
          <>
            <span className="h-[5px] w-10 flex-none overflow-hidden rounded bg-line2 md:w-auto md:flex-1"><i className="block h-full origin-left rtl:origin-right bg-acid transition-transform duration-500 ease-linear" style={{ transform: `scaleX(${Math.min(1, d.progress)})` }} /></span>
            <span className="min-w-[34px] text-end font-mono text-[12.5px]">{Math.round(d.progress * 100)}%</span>
          </>
        ) : <span>{t(statusKey(st))}</span>}
      </div>
      <span className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 max-[900px]:opacity-100" onClick={(e) => e.stopPropagation()}>
        {(st === "idle" || st === "canceled" || st === "failed") && <LinkBtn onClick={() => act(() => parseDocuments([d.id]), t("processStarted"))}>{st === "failed" ? t("retry") : t("start")}</LinkBtn>}
        {busy && <LinkBtn onClick={() => act(() => stopParsing([d.id]))}>{t("stopParse")}</LinkBtn>}
        <LinkBtn onClick={() => set({ viewer: { docId: d.id, from: "files" } })}>{t("view")}</LinkBtn>
        <LinkBtn className={cn(confirm && "text-danger")} onClick={() => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); } else act(() => deleteDocuments([d.id]), t("deleted")); }}>{confirm ? t("delConfirm") : t("del")}</LinkBtn>
      </span>
    </div>
  );
}

function Seg({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div role="group" className="relative inline-flex rounded-full bg-surface p-[3px] shadow-[inset_0_0_0_1px_var(--line)]">
      {items.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={cn("press h-8 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors", value === k ? "bg-surface2 font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" : "font-medium text-ink2")}>{label}</button>
      ))}
    </div>
  );
}
