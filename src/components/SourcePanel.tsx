import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, X } from "lucide-react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { useDoc } from "@/hooks";
import { fmtSize, lastMessage, pageOf, statusOf } from "@/lib/format";
import { downloadOriginal } from "@/lib/download";
import { Btn, FileTile, IconBtn } from "./ui";

/** Right-hand panel: the exact passages an answer used from one file, or a summary of a file. */
export function SourcePanel() {
  const { t } = useT();
  const panel = useUi((s) => s.panel);
  const set = useUi((s) => s.set);
  const msg = useStore((s) => {
    const chat = s.chats.find((c) => c.id === s.activeChatId);
    return panel?.msgId ? chat?.messages.find((m) => m.id === panel.msgId) : undefined;
  });
  const doc = useDoc(panel?.docId);

  const aggs = msg?.reference?.doc_aggs ?? [];
  const chunks = useMemo(() => (msg?.reference?.chunks ?? []).filter((c) => c.document_id === panel?.docId).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)), [msg, panel?.docId]);
  if (!panel) return null;

  const name = doc?.name ?? aggs.find((a) => a.doc_id === panel.docId)?.doc_name ?? chunks[0]?.document_name ?? "";
  const suffix = doc?.suffix ?? name.split(".").pop();
  const fromChat = panel.from === "chat" && chunks.length > 0;
  const idx = aggs.findIndex((a) => a.doc_id === panel.docId);
  const best = chunks[0];
  const go = (d: number) => aggs.length && set({ panel: { ...panel, docId: aggs[(idx + d + aggs.length) % aggs.length].doc_id } });
  const status = doc ? statusOf(doc) : "ready";
  const group = status === "ready" ? "ready" : status === "failed" ? "failed" : status === "parsing" || status === "queued" ? "busy" : "idle";

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-canvas2 shadow-[inset_0_0_0_1px_var(--line)]
      max-[1220px]:fixed max-[1220px]:inset-y-2.5 max-[1220px]:end-2.5 max-[1220px]:z-30 max-[1220px]:w-[min(400px,calc(100vw-20px))] max-[1220px]:shadow-[var(--shadow-float),inset_0_0_0_1px_var(--line-strong)]
      max-[900px]:inset-x-0 max-[900px]:end-0 max-[900px]:top-auto max-[900px]:bottom-0 max-[900px]:h-[78dvh] max-[900px]:w-auto max-[900px]:rounded-b-none max-[900px]:rounded-t-[28px]">
      <div key={panel.docId} className="flex h-full min-h-0 animate-panel-in flex-col max-[900px]:animate-sheet-in">
        <div className="flex items-start gap-3 py-4 ps-[18px] pe-3">
          <FileTile suffix={suffix} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] leading-snug font-semibold break-words"><bdi>{name}</bdi></h2>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink3">
              {fromChat ? (<>{pageOf(best?.positions) && <span>{t("pg", { p: pageOf(best.positions)! })}</span>}{best?.similarity !== undefined && <span className="font-semibold text-accent">{t("match", { x: Math.round(best.similarity * 100) })}</span>}</>)
                : doc && (<><span><bdi>{fmtSize(doc.size)}</bdi></span><span>{t("chunks", { n: doc.chunk_count })}</span></>)}
            </div>
          </div>
          <IconBtn aria-label={t("close")} onClick={() => set({ panel: null })}><X size={18} /></IconBtn>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {fromChat ? (
            <div className="grid gap-3">
              {chunks.map((c) => (
                <div key={c.id} className="rounded-md bg-paper p-[22px] text-[13.5px] leading-[1.75] text-papertext shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]" dir="auto">
                  <div className="mb-3.5 flex justify-between gap-2.5 text-[11px] text-papermute">
                    <span>{pageOf(c.positions) ? t("pg", { p: pageOf(c.positions)! }) : ""}</span>
                    <span>{c.similarity !== undefined ? t("match", { x: Math.round(c.similarity * 100) }) : ""}</span>
                  </div>
                  <p className="break-words whitespace-pre-wrap"><mark className="hl">{c.content.trim()}</mark></p>
                </div>
              ))}
              <p className="text-[12.5px] leading-relaxed text-ink3">{t("passageNote")}</p>
            </div>
          ) : (
            <div className="rounded-md bg-paper p-[22px] text-[13.5px] leading-[1.75] text-papertext shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
              <h3 className="mb-2 text-[15px] font-semibold text-paperhead">{t(`pv_t_${group}` as "pv_t_ready")}</h3>
              <p>{t(`pv_${group}` as "pv_ready", { n: doc?.chunk_count ?? 0 })}</p>
              {status === "failed" && doc && <p className="mt-3 rounded-md bg-black/[0.05] p-3 font-mono text-xs break-words" dir="ltr">{lastMessage(doc)}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3.5 py-3">
          <Btn variant="primary" onClick={() => set({ viewer: { docId: panel.docId, page: pageOf(best?.positions), highlight: best?.positions, from: panel.from }, panel: null })}>
            <Eye size={18} />{fromChat ? t("viewDocBtn") : t("viewFileBtn")}
          </Btn>
          <IconBtn aria-label={t("download")} onClick={() => downloadOriginal(panel.docId, name)}><Download size={18} /></IconBtn>
          <span className="flex-1" />
          {fromChat && aggs.length > 1 && (
            <>
              <IconBtn aria-label={t("prevSrc")} onClick={() => go(-1)}><ChevronRight size={18} className="ltr:rotate-180" /></IconBtn>
              <span className={cn("min-w-9 text-center font-mono text-xs text-ink3")}>{idx + 1} / {aggs.length}</span>
              <IconBtn aria-label={t("nextSrc")} onClick={() => go(1)}><ChevronLeft size={18} className="ltr:rotate-180" /></IconBtn>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
