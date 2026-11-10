import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, Search } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { renderAsync } from "docx-preview";
import readXlsxFile from "read-excel-file/browser";
import { useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { downloadDocument, isAbort } from "@/lib/ragflow";
import { downloadOriginal } from "@/lib/download";
import { renderMarkdown } from "@/lib/markdown";
import { useDebounced, useDoc } from "@/hooks";
import { Btn, FileTile, IconBtn } from "./ui";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * RAGFlow's `positions` are [page, x0, x1, top, bottom] in pixels of the page rendered at this zoom
 * (3x PDF points). Verify against your RAGFlow version; set to 0 to disable the highlight rectangles.
 */
const POSITION_ZOOM = 3;
const CSS_PX_PER_PT = 96 / 72;

type Kind = "pdf" | "docx" | "xlsx" | "md" | "text" | "image" | "none";
const kindOf = (name: string, blob: Blob): Kind => {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (ext === "md" || ext === "markdown") return "md";
  if (["txt", "csv", "json", "log", "xml", "yml", "yaml", "tsv"].includes(ext)) return "text";
  if (blob.type.startsWith("image/")) return "image";
  return "none";
};

interface Info { pages: number; page: number; matches: number; matchPages: number[] }

export default function Viewer() {
  const { t } = useT();
  const v = useUi((s) => s.viewer)!;
  const set = useUi((s) => s.set);
  const doc = useDoc(v.docId);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(() => Math.max(0.55, Math.min(1, (Math.min(innerWidth, 1100) - (innerWidth < 900 ? 40 : 330)) / 640)));
  const [term, setTerm] = useState("");
  const [nonce, setNonce] = useState(0);
  const [info, setInfo] = useState<Info>({ pages: 0, page: v.page ?? 1, matches: 0, matchPages: [] });
  const [goto, setGoto] = useState<{ page: number; n: number } | null>(v.page ? { page: v.page, n: 1 } : null);
  const q = useDebounced(term.trim(), 300);

  useEffect(() => {
    setBlob(null); setError("");
    const ctl = new AbortController();
    downloadDocument(v.docId, ctl.signal).then(setBlob).catch((e) => { if (!isAbort(e)) setError(e.message); });
    return () => ctl.abort();
  }, [v.docId]);

  const name = doc?.name ?? "";
  const kind = blob && name ? kindOf(name, blob) : null;
  const patch = useCallback((p: Partial<Info>) => setInfo((i) => ({ ...i, ...p })), []);
  const jump = (page: number) => setGoto((g) => ({ page, n: (g?.n ?? 0) + 1 }));
  const zoomBy = (d: number) => setZoom((z) => Math.max(0.55, Math.min(2, +(z + d).toFixed(2))));
  const canZoom = kind === "pdf" || kind === "docx" || kind === "xlsx" || kind === "md" || kind === "text";

  const onFindEnter = () => {
    if (kind === "pdf") {
      const next = info.matchPages.find((p) => p > info.page) ?? info.matchPages[0];
      if (next) jump(next);
    } else setNonce((n) => n + 1);
  };

  return (
    <section className="absolute inset-0 z-10 flex min-h-0 flex-col bg-canvas2">
      <div className="glass absolute inset-x-3.5 top-3 z-[5] flex h-[52px] items-center gap-1 rounded-full ps-2 pe-2 max-[900px]:inset-x-2.5">
        <Btn variant="ghost" className="px-3" onClick={() => set({ viewer: null })}><ChevronLeft size={18} className="rtl:-scale-x-100" />{t(v.from === "chat" ? "navChat" : "navFiles")}</Btn>
        {name && <FileTile suffix={doc?.suffix} size="xs" />}
        <h1 className="min-w-0 flex-1 truncate ps-1 text-sm font-semibold"><bdi>{name}</bdi></h1>
        <label className="flex h-8 w-[200px] items-center gap-2 rounded-full bg-white/[0.07] px-3 text-ink3 shadow-[inset_0_0_0_1px_var(--line)] light:bg-white/80 max-[900px]:hidden">
          <Search size={15} /><span className="sr-only">{t("find")}</span>
          <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onFindEnter()} placeholder={t("find")} className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink3" />
          {q && <small className="text-[11px] whitespace-nowrap">{info.matches ? t("found", { n: info.matches }) : t("none")}</small>}
        </label>
        {kind === "pdf" && (
          <>
            <IconBtn aria-label={t("prevPage")} disabled={info.page <= 1} onClick={() => jump(info.page - 1)}><ChevronLeft size={18} className="rtl:-scale-x-100" /></IconBtn>
            <span dir="ltr" className="min-w-[50px] text-center font-mono text-[12.5px] text-ink2">{info.page} / {info.pages || "–"}</span>
            <IconBtn aria-label={t("nextPage")} disabled={info.page >= info.pages} onClick={() => jump(info.page + 1)}><ChevronRight size={18} className="rtl:-scale-x-100" /></IconBtn>
          </>
        )}
        {canZoom && (
          <span className="flex items-center max-[900px]:hidden">
            <IconBtn aria-label={t("zoomOut")} onClick={() => zoomBy(-0.15)}><Minus size={18} /></IconBtn>
            <span dir="ltr" className="min-w-[46px] text-center font-mono text-[12.5px] text-ink2">{Math.round(zoom * 100)}%</span>
            <IconBtn aria-label={t("zoomIn")} onClick={() => zoomBy(0.15)}><Plus size={18} /></IconBtn>
          </span>
        )}
        <IconBtn aria-label={t("download")} onClick={() => downloadOriginal(v.docId, name || "file")}><Download size={18} /></IconBtn>
      </div>

      {error ? <Notice>{error}</Notice> : !blob || !kind ? <Notice>{t("loadingDoc")}</Notice> : (
        <>
          {kind === "pdf" && <PdfViewer blob={blob} zoom={zoom} term={q} highlight={v.highlight} goto={goto} onInfo={patch} />}
          {kind === "docx" && <Scroll><DocxViewer blob={blob} zoom={zoom} term={q} nonce={nonce} onMatches={(n) => patch({ matches: n })} /></Scroll>}
          {kind === "xlsx" && <Scroll><SheetViewer blob={blob} zoom={zoom} term={q} nonce={nonce} onMatches={(n) => patch({ matches: n })} /></Scroll>}
          {(kind === "md" || kind === "text") && <Scroll><TextViewer blob={blob} md={kind === "md"} zoom={zoom} term={q} nonce={nonce} onMatches={(n) => patch({ matches: n })} /></Scroll>}
          {kind === "image" && <Scroll><ImageViewer blob={blob} /></Scroll>}
          {kind === "none" && <Notice>{t("noPreview")}<Btn variant="primary" className="mt-4" onClick={() => downloadOriginal(v.docId, name)}><Download size={16} />{t("downloadFile")}</Btn></Notice>}
        </>
      )}
    </section>
  );
}

const Notice = ({ children }: { children: React.ReactNode }) => <div className="grid flex-1 place-content-center justify-items-center text-ink2">{children}</div>;
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-auto px-6 pt-[76px] pb-28 max-[900px]:px-3">{children}</div>;

/* ───────── Find (docx, xlsx, md, text) ───────── */

function useFind(ref: React.RefObject<HTMLElement | null>, term: string, nonce: number, onMatches: (n: number) => void, ready: unknown) {
  const ranges = useRef<Range[]>([]);
  const at = useRef(-1);
  useEffect(() => {
    const el = ref.current;
    const css = CSS as unknown as { highlights?: Map<string, unknown> };
    css.highlights?.delete("find");
    ranges.current = []; at.current = -1;
    if (!el || !term) return onMatches(0);
    const needle = term.toLowerCase();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? "").toLowerCase();
      for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + needle.length); ranges.current.push(r);
      }
    }
    const HL = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (HL && css.highlights) css.highlights.set("find", new HL(...ranges.current));
    onMatches(ranges.current.length);
    ranges.current[0]?.startContainer.parentElement?.scrollIntoView({ block: "center" });
    return () => { css.highlights?.delete("find"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, ready]);
  useEffect(() => {
    if (!nonce || !ranges.current.length) return;
    at.current = (at.current + 1) % ranges.current.length;
    ranges.current[at.current].startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [nonce]);
}

interface TextProps { blob: Blob; zoom: number; term: string; nonce: number; onMatches: (n: number) => void }

function DocxViewer({ blob, zoom, term, nonce, onMatches }: TextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    setReady(false);
    const el = ref.current; if (!el) return;
    el.innerHTML = "";
    renderAsync(blob, el, undefined, { className: "docx", inWrapper: true, breakPages: true }).then(() => setReady(true)).catch((e) => setErr(String(e)));
  }, [blob]);
  useFind(ref, term, nonce, onMatches, ready);
  return err ? <Notice>{err}</Notice> : <div ref={ref} style={{ zoom }} className="docx-host max-w-full overflow-x-auto" />;
}

function SheetViewer({ blob, zoom, term, nonce, onMatches }: TextProps) {
  const { t } = useT();
  const [sheets, setSheets] = useState<{ sheet: string; data: unknown[][] }[]>([]);
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { readXlsxFile(blob).then((s) => setSheets(s as never)).catch((e) => setErr(String(e))); }, [blob]);
  useFind(ref, term, nonce, onMatches, `${tab}${sheets.length}`);
  if (err) return <Notice>{err}</Notice>;
  const rows = sheets[tab]?.data ?? [];
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const letter = (i: number) => String.fromCharCode(65 + (i % 26));
  return (
    <div style={{ zoom }} className="max-w-full">
      {sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">{sheets.map((s, i) => (
          <button key={s.sheet} onClick={() => setTab(i)} className={cn("press h-8 rounded-full px-3.5 text-[13px] font-medium", i === tab ? "bg-ink text-canvas" : "bg-surface text-ink2 shadow-[inset_0_0_0_1px_var(--line)]")}>{s.sheet || `${t("sheet")} ${i + 1}`}</button>
        ))}</div>
      )}
      <div ref={ref} className="overflow-auto rounded-md bg-paper shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]">
        <table className="border-collapse text-xs text-papertext" dir="auto">
          <thead><tr><th className="border border-paperline bg-[#eef1ec] px-2.5 py-1.5" />{Array.from({ length: cols }, (_, i) => <th key={i} className="border border-paperline bg-[#eef1ec] px-2.5 py-1.5 font-medium text-papermute">{letter(i)}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}><td className="border border-paperline bg-[#f4f6f2] px-2.5 py-1.5 text-center text-papermute">{i + 1}</td>{Array.from({ length: cols }, (_, j) => <td key={j} className="border border-paperline px-2.5 py-1.5 whitespace-nowrap">{r[j] === null || r[j] === undefined ? "" : String(r[j])}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TextViewer({ blob, md, zoom, term, nonce, onMatches }: TextProps & { md: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { blob.text().then(setText); }, [blob]);
  useFind(ref, term, nonce, onMatches, text);
  const html = useMemo(() => (md && text ? renderMarkdown(text) : ""), [md, text]);
  if (text === null) return null;
  return (
    <div ref={ref} style={{ fontSize: 14 * zoom }} className="w-full max-w-[760px] rounded-md bg-paper p-[52px] text-papertext shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] max-[900px]:p-6">
      {md ? <div className="prose-chat" dir="auto" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="font-mono leading-relaxed break-words whitespace-pre-wrap" dir="auto">{text}</pre>}
    </div>
  );
}

function ImageViewer({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="max-h-full max-w-full rounded-md shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]" />;
}

/* ───────── PDF ───────── */

function PdfViewer({ blob, zoom, term, highlight, goto, onInfo }: { blob: Blob; zoom: number; term: string; highlight?: number[][]; goto: { page: number; n: number } | null; onInfo: (p: Partial<Info>) => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState({ w: 612, h: 792 });
  const [err, setErr] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false, doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (dead) return;
        const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
        setPdf(doc);
        onInfo({ pages: doc.numPages });
      } catch (e) { setErr(String(e)); }
    })();
    return () => { dead = true; void doc?.destroy(); };
  }, [blob, onInfo]);

  const scrollTo = useCallback((page: number, smooth: boolean) => {
    const sc = scroller.current, el = document.getElementById(`pdf-page-${page}`);
    if (sc && el) sc.scrollTo({ top: el.offsetTop - sc.offsetTop - 14, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useEffect(() => { if (pdf && goto) requestAnimationFrame(() => scrollTo(goto.page, goto.n > 1)); }, [pdf, goto, scrollTo]);

  const track = useCallback(() => {
    const sc = scroller.current; if (!sc || !pdf) return;
    let cur = 1;
    for (let n = 1; n <= pdf.numPages; n++) { const el = document.getElementById(`pdf-page-${n}`); if (el && el.offsetTop - sc.offsetTop - 80 <= sc.scrollTop) cur = n; else break; }
    onInfo({ page: cur });
  }, [pdf, onInfo]);

  // Page-level search: pdf.js text is read per page, matches are counted and Enter hops between pages.
  useEffect(() => {
    if (!pdf || !term) return onInfo({ matches: 0, matchPages: [] });
    let dead = false;
    (async () => {
      const needle = term.toLowerCase(), pages: number[] = []; let total = 0;
      for (let n = 1; n <= pdf.numPages && !dead; n++) {
        const tc = await (await pdf.getPage(n)).getTextContent();
        const text = tc.items.map((i) => ("str" in i ? i.str : "")).join(" ").toLowerCase();
        let c = 0; for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) c++;
        if (c) { total += c; pages.push(n); }
      }
      if (!dead) onInfo({ matches: total, matchPages: pages });
    })();
    return () => { dead = true; };
  }, [pdf, term, onInfo]);

  if (err) return <Notice>{err}</Notice>;
  if (!pdf) return <Notice><span className="inline-block size-5 animate-spin rounded-full border-2 border-line2 border-t-acid" /></Notice>;
  const pages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[148px_minmax(0,1fr)] pt-[76px] max-[900px]:grid-cols-1">
      <div className="grid content-start justify-items-center gap-3.5 overflow-y-auto px-4 pt-3.5 pb-24 max-[900px]:hidden">
        {pages.map((n) => <PdfThumb key={n} pdf={pdf} n={n} onClick={() => scrollTo(n, true)} />)}
      </div>
      <div ref={scroller} onScroll={track} className="flex flex-col items-center gap-[22px] overflow-auto px-6 pt-3.5 pb-28 max-[900px]:px-3">
        {pages.map((n) => <PdfPage key={n} pdf={pdf} n={n} zoom={zoom} base={base} marks={highlight?.filter((p) => p[0] === n)} />)}
      </div>
    </div>
  );
}

function useVisible<T extends Element>(margin = "900px") {
  const ref = useRef<T>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { rootMargin: `${margin} 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, vis] as const;
}

function PdfPage({ pdf, n, zoom, base, marks }: { pdf: PDFDocumentProxy; n: number; zoom: number; base: { w: number; h: number }; marks?: number[][] }) {
  const [ref, vis] = useVisible<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const px = zoom * CSS_PX_PER_PT;
  const [size, setSize] = useState({ w: base.w * px, h: base.h * px });
  useEffect(() => { setSize({ w: base.w * px, h: base.h * px }); }, [base, px]);

  useEffect(() => {
    if (!vis) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | undefined, dead = false;
    (async () => {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: px });
      const c = canvas.current; if (!c || dead) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      setSize({ w: vp.width, h: vp.height });
      task = page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
      await task.promise.catch(() => {});
    })();
    return () => { dead = true; task?.cancel(); };
  }, [vis, pdf, n, px]);

  return (
    <div ref={ref} id={`pdf-page-${n}`} style={{ width: size.w, height: size.h }} className="relative flex-none rounded-[3px] bg-paper shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]">
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} className="block rounded-[3px]" />
      {POSITION_ZOOM > 0 && marks?.map((p, i) => {
        const k = px / POSITION_ZOOM;
        const [, x0, x1, top, bottom] = p;
        const w = (x1 - x0) * k, h = (bottom - top) * k;
        return w > 4 && h > 4 ? <div key={i} className="pointer-events-none absolute rounded-sm bg-[rgba(100,255,60,0.45)] mix-blend-multiply" style={{ left: x0 * k, top: top * k, width: w, height: h }} /> : null;
      })}
    </div>
  );
}

function PdfThumb({ pdf, n, onClick }: { pdf: PDFDocumentProxy; n: number; onClick: () => void }) {
  const [ref, vis] = useVisible<HTMLButtonElement>("400px");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!vis) return;
    let dead = false;
    (async () => {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 84 / page.getViewport({ scale: 1 }).width });
      const c = canvas.current; if (!c || dead) return;
      c.width = vp.width * 2; c.height = vp.height * 2; c.style.width = `${vp.width}px`; c.style.height = `${vp.height}px`;
      await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp, transform: [2, 0, 0, 2, 0, 0] }).promise.catch(() => {});
    })();
    return () => { dead = true; };
  }, [vis, pdf, n]);
  return (
    <button ref={ref} type="button" aria-label={String(n)} onClick={onClick} className="press grid justify-items-center gap-1.5 rounded-[10px] p-1 font-mono text-[11px] text-ink3">
      <canvas ref={canvas} className="min-h-[108px] min-w-[84px] rounded-md bg-paper shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]" />
      {n}
    </button>
  );
}
