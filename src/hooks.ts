import { useCallback, useEffect, useRef, useState } from "react";
import { listDocuments, listReadyDocuments, type DocQuery } from "@/lib/ragflow";
import type { RFDoc } from "@/lib/types";
import { useStore, useUi } from "@/store";

/** Fired when a file finishes processing or is added/removed, so other lists can refresh. */
export const DOCS_CHANGED = "shaul:docs-changed";
export const notifyDocsChanged = () => window.dispatchEvent(new Event(DOCS_CHANGED));

const remember = (docs: RFDoc[]) => {
  const names = { ...useUi.getState().docNames };
  docs.forEach((d) => (names[d.id] = d));
  useUi.setState({ docNames: names });
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One page of documents from RAGFlow. Polls every 2 s while any file is being processed. */
export function useDocuments(q: DocQuery) {
  const ready = useStore((s) => !!(s.apiKey && s.datasetId));
  const [state, setState] = useState<{ docs: RFDoc[]; total: number | null; loading: boolean; error?: string }>({ docs: [], total: null, loading: true });
  const seq = useRef(0);
  const prevRuns = useRef<Record<string, string>>({});
  const key = JSON.stringify(q);

  const load = useCallback(async (silent = false) => {
    if (!ready) return setState((s) => ({ ...s, loading: false }));
    const mine = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const r = await listDocuments(JSON.parse(key));
      if (mine !== seq.current) return;
      remember(r.docs);
      const finished = r.docs.some((d) => d.run === "DONE" && prevRuns.current[d.id] && prevRuns.current[d.id] !== "DONE");
      prevRuns.current = Object.fromEntries(r.docs.map((d) => [d.id, d.run]));
      setState({ docs: r.docs, total: r.total, loading: false });
      if (finished) notifyDocsChanged();
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, [key, ready]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => load(true);
    window.addEventListener(DOCS_CHANGED, on);
    return () => window.removeEventListener(DOCS_CHANGED, on);
  }, [load]);
  const busy = state.docs.some((d) => d.run === "RUNNING" || d.run === "SCHEDULE");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => load(true), 2000);
    return () => clearInterval(t);
  }, [busy, load]);

  return { ...state, reload: () => load(true) };
}

/** Every ready file, for the picker and for deciding what "all files" means. */
export function useReadyDocs() {
  const ready = useStore((s) => !!(s.apiKey && s.datasetId));
  const [state, setState] = useState<{ docs: RFDoc[]; loading: boolean }>({ docs: [], loading: true });
  const load = useCallback(async () => {
    if (!ready) return setState({ docs: [], loading: false });
    try {
      const docs = await listReadyDocuments();
      remember(docs);
      setState({ docs, loading: false });
    } catch { setState((s) => ({ ...s, loading: false })); }
  }, [ready]);
  useEffect(() => {
    load();
    window.addEventListener(DOCS_CHANGED, load);
    return () => window.removeEventListener(DOCS_CHANGED, load);
  }, [load]);
  return state;
}

/** Looks a document up by id: from what is already loaded, else from RAGFlow. */
export function useDoc(id: string | undefined): RFDoc | undefined {
  const cached = useUi((s) => (id ? s.docNames[id] : undefined));
  useEffect(() => {
    if (!id || cached) return;
    listDocuments({ page: 1, pageSize: 1, id }).then((r) => remember(r.docs)).catch(() => {});
  }, [id, cached]);
  return cached;
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
