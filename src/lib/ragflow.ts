/**
 * RAGFlow HTTP API client (RAGFlow 1.0), called straight from the browser.
 * Endpoints used, all from the official HTTP API reference:
 *   datasets, documents (upload / list / download / update / delete), chunks (parse / stop),
 *   chats (create / list), and POST /api/v1/openai/{chat_id}/chat/completions for answers.
 */
import { useStore, type Lang } from "@/store";
import type { RFDoc, RefAgg, RefChunk, Reference, RunStatus } from "./types";

export const DATASET_NAME = "shaul-files";
export const CHAT_NAME = "Shaul";
/** Metadata key written to every document so a chat can be limited to chosen files. */
export const SCOPE_KEY = "file_id";

export class RagflowError extends Error {
  constructor(message: string, public code?: number, public status?: number) {
    super(message);
  }
}
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

const cfg = () => {
  const { baseUrl, apiKey, datasetId, chatId } = useStore.getState();
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, datasetId, chatId };
};

type Params = Record<string, string | number | boolean | string[] | undefined>;
function endpoint(path: string, params?: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return `${cfg().baseUrl}${path}${s ? `?${s}` : ""}`;
}
const auth = () => ({ Authorization: `Bearer ${cfg().apiKey}` });

function requireSetup() {
  if (!cfg().apiKey) throw new RagflowError("NO_SETUP");
}

interface CallOpts { method?: string; params?: Params; json?: unknown; signal?: AbortSignal }

/** Calls an endpoint that answers with the standard `{ code, message, data }` envelope. */
async function call<T = unknown>(path: string, o: CallOpts = {}): Promise<T> {
  requireSetup();
  let res: Response;
  try {
    res = await fetch(endpoint(path, o.params), {
      method: o.method ?? "GET",
      headers: { ...auth(), ...(o.json !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: o.json !== undefined ? JSON.stringify(o.json) : undefined,
      signal: o.signal,
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new RagflowError("Cannot reach RAGFlow. Check the address and CORS / proxy settings.");
  }
  const body = await readEnvelope(res);
  return body.data as T;
}

async function readEnvelope(res: Response) {
  const text = await res.text();
  let body: { code?: number; message?: string; data?: unknown };
  try { body = JSON.parse(text); } catch { throw new RagflowError(res.ok ? "Unexpected response from RAGFlow" : `HTTP ${res.status}`, undefined, res.status); }
  if ((body.code !== undefined && body.code !== 0) || !res.ok) {
    throw new RagflowError(body.message || `HTTP ${res.status}`, body.code, res.status);
  }
  return body;
}

/* ───────── Setup ───────── */

export async function testConnection() {
  await call("/api/v1/datasets", { params: { page: 1, page_size: 1 } });
}

const SYSTEM_PROMPT = [
  "You are Shaul, an assistant that answers questions using only the knowledge base below.",
  "Answer in the same language as the user's question. Be concise and concrete.",
  "If the knowledge base does not contain the answer, say so plainly. Never invent facts.",
  "",
  "Knowledge base:",
  "{knowledge}",
  "",
  "The knowledge base is above.",
].join("\n");

const EMPTY_RESPONSE = "לא מצאתי תשובה בקבצים שנבחרו. / I could not find an answer in the selected files.";

type Named = { id: string; name?: string };
const asList = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : []);

/** Finds (or creates) the dataset and chat assistant this app uses, and remembers their ids. */
export async function ensureResources(lang: Lang) {
  requireSetup();
  let { datasetId, chatId } = cfg();
  if (!datasetId) {
    const found = await call<Named[]>("/api/v1/datasets", { params: { name: DATASET_NAME, page: 1, page_size: 1 } }).catch(() => []);
    datasetId = asList<Named>(found)[0]?.id ?? "";
    if (!datasetId) {
      const created = await call<Named>("/api/v1/datasets", {
        method: "POST",
        json: { name: DATASET_NAME, language: lang === "he" ? "Hebrew" : "English", parse_type: 1, parser_id: "general" },
      });
      datasetId = created.id;
    }
    useStore.getState().setSettings({ datasetId });
  }
  if (!chatId) {
    const found = await call<Named[]>("/api/v1/chats", { params: { name: CHAT_NAME, page: 1, page_size: 1 } }).catch(() => []);
    chatId = asList<Named>(found)[0]?.id ?? "";
    if (!chatId) {
      const created = await call<Named>("/api/v1/chats", {
        method: "POST",
        json: {
          name: CHAT_NAME,
          dataset_ids: [datasetId],
          prompt_config: { system: SYSTEM_PROMPT, parameters: [{ key: "knowledge", optional: false }], empty_response: EMPTY_RESPONSE, quote: true, refine_multiturn: true },
        },
      });
      chatId = created.id;
    }
    useStore.getState().setSettings({ chatId });
  }
  return { datasetId, chatId };
}

/* ───────── Documents ───────── */

const RUN_BY_NUMBER: Record<string, RunStatus> = { "0": "UNSTART", "1": "RUNNING", "2": "CANCEL", "3": "DONE", "4": "FAIL", "5": "SCHEDULE" };

function normalizeDoc(d: Partial<RFDoc> & { id: string; name: string }): RFDoc {
  const run = String(d.run ?? "UNSTART").toUpperCase();
  return {
    ...d,
    run: RUN_BY_NUMBER[run] ?? run,
    progress: Number(d.progress ?? 0),
    size: Number(d.size ?? 0),
    chunk_count: Number(d.chunk_count ?? 0),
    suffix: (d.suffix || d.name.split(".").pop() || "").toLowerCase(),
  };
}

export interface DocQuery { page: number; pageSize: number; keywords?: string; run?: string[]; suffix?: string[]; id?: string }

export async function listDocuments(q: DocQuery) {
  const { datasetId } = cfg();
  const d = await call<{ docs?: RFDoc[]; total?: number; total_datasets?: number }>(`/api/v1/datasets/${datasetId}/documents`, {
    params: { page: q.page, page_size: q.pageSize, keywords: q.keywords, run: q.run, suffix: q.suffix, id: q.id, orderby: "create_time", desc: true },
  });
  const docs = asList<RFDoc & { id: string; name: string }>(d?.docs).map(normalizeDoc);
  return { docs, total: typeof d?.total === "number" ? d.total : typeof d?.total_datasets === "number" ? d.total_datasets : null };
}

/** Every document that finished processing, across pages (the file picker needs the full list). */
export async function listReadyDocuments(): Promise<RFDoc[]> {
  const out: RFDoc[] = [];
  for (let page = 1; page <= 20; page++) {
    const { docs } = await listDocuments({ page, pageSize: 100, run: ["DONE"] });
    out.push(...docs);
    if (docs.length < 100) break;
  }
  return out;
}

export function uploadFile(file: File, onProgress: (p: number) => void): Promise<RFDoc[]> {
  requireSetup();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint(`/api/v1/datasets/${cfg().datasetId}/documents`));
    xhr.setRequestHeader("Authorization", `Bearer ${cfg().apiKey}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new RagflowError("Cannot reach RAGFlow"));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if ((body.code !== undefined && body.code !== 0) || xhr.status >= 400) return reject(new RagflowError(body.message || `HTTP ${xhr.status}`, body.code, xhr.status));
        resolve(asList<RFDoc & { id: string; name: string }>(body.data).map(normalizeDoc));
      } catch { reject(new RagflowError(`HTTP ${xhr.status}`)); }
    };
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

/** Starts processing. Datasets that use an ingestion pipeline need /documents/ingest instead. */
export async function parseDocuments(ids: string[]) {
  try {
    await call(`/api/v1/datasets/${cfg().datasetId}/chunks`, { method: "POST", json: { document_ids: ids } });
  } catch (e) {
    if (isAbort(e)) throw e;
    await call("/api/v1/documents/ingest", { method: "POST", json: { doc_ids: ids, run: "1", delete: true } });
  }
}

export async function stopParsing(ids: string[]) {
  try {
    await call(`/api/v1/datasets/${cfg().datasetId}/chunks`, { method: "DELETE", json: { document_ids: ids } });
  } catch (e) {
    if (isAbort(e)) throw e;
    await call("/api/v1/documents/ingest", { method: "POST", json: { doc_ids: ids, run: "2" } });
  }
}

export async function deleteDocuments(ids: string[]) {
  await call(`/api/v1/datasets/${cfg().datasetId}/documents`, { method: "DELETE", json: { ids } });
}

export async function downloadDocument(id: string, signal?: AbortSignal): Promise<Blob> {
  requireSetup();
  let res: Response;
  try { res = await fetch(endpoint(`/api/v1/datasets/${cfg().datasetId}/documents/${id}`), { headers: auth(), signal }); }
  catch (e) { if (isAbort(e)) throw e; throw new RagflowError("Cannot reach RAGFlow"); }
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) await readEnvelope(res); // a JSON body here is an error envelope
  if (!res.ok) throw new RagflowError(`HTTP ${res.status}`, undefined, res.status);
  return res.blob();
}

/**
 * Writes `file_id = <document id>` into each document's metadata, once.
 * A chat limited to chosen files filters on this key (see `metadataCondition`).
 */
export async function tagDocuments(ids: string[]) {
  const { tagged } = useStore.getState();
  const todo = ids.filter((id) => !tagged.includes(id));
  const queue = [...todo];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await call(`/api/v1/datasets/${cfg().datasetId}/documents/${id}`, { method: "PATCH", json: { meta_fields: { [SCOPE_KEY]: id } } });
      useStore.getState().markTagged([id]);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/* ───────── Chat ───────── */

export function metadataCondition(ids: string[] | null) {
  if (!ids) return undefined; // all files: no filter
  return { logic: "or", conditions: ids.map((id) => ({ name: SCOPE_KEY, comparison_operator: "is", value: id })) };
}

function normalizeReference(raw: unknown): Reference | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { chunks?: unknown; doc_aggs?: unknown };
  const toArr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : x && typeof x === "object" ? (Object.values(x) as T[]) : []);
  const chunks = toArr<Record<string, unknown>>(r.chunks).map(
    (c): RefChunk => ({
      id: String(c.id ?? ""),
      content: String(c.content ?? ""),
      document_id: String(c.document_id ?? c.doc_id ?? ""),
      document_name: String(c.document_name ?? c.docnm_kwd ?? ""),
      positions: Array.isArray(c.positions) ? (c.positions as number[][]) : undefined,
      similarity: typeof c.similarity === "number" ? c.similarity : undefined,
    }),
  );
  const doc_aggs = toArr<Record<string, unknown>>(r.doc_aggs).map((a): RefAgg => ({ doc_id: String(a.doc_id ?? ""), doc_name: String(a.doc_name ?? ""), count: Number(a.count ?? 1) }));
  return chunks.length || doc_aggs.length ? { chunks, doc_aggs } : undefined;
}

/** RAGFlow's own citation markers must never reach the screen. */
export const stripMarkers = (s: string) => s.replace(/##\d+\$\$/g, "").replace(/\[ID:\d+\]/g, "");

export interface StreamOpts {
  messages: { role: "user" | "assistant"; content: string }[];
  scope: string[] | null;
  signal: AbortSignal;
  onText: (full: string) => void;
}

/** Streams an answer (SSE). Returns the final text and the reference (sources) RAGFlow attached. */
export async function chatStream(o: StreamOpts): Promise<{ text: string; reference?: Reference }> {
  requireSetup();
  const { chatId } = cfg();
  if (!chatId) throw new RagflowError("NO_SETUP");
  const res = await fetch(endpoint(`/api/v1/openai/${chatId}/chat/completions`), {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "model",
      messages: o.messages,
      stream: true,
      extra_body: { reference: true, metadata_condition: metadataCondition(o.scope) },
    }),
    signal: o.signal,
  }).catch((e) => { if (isAbort(e)) throw e; throw new RagflowError("Cannot reach RAGFlow"); });

  if ((res.headers.get("content-type") ?? "").includes("application/json")) await readEnvelope(res);
  if (!res.ok || !res.body) throw new RagflowError(`HTTP ${res.status}`, undefined, res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", text = "", reference: Reference | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let j: { choices?: { delta?: { content?: string | null; reference?: unknown } }[]; code?: number; message?: string };
      try { j = JSON.parse(payload); } catch { continue; }
      if (j.code && j.code !== 0) throw new RagflowError(j.message || "Request failed", j.code);
      const delta = j.choices?.[0]?.delta;
      if (delta?.content) { text += delta.content; o.onText(stripMarkers(text)); }
      if (delta?.reference) reference = normalizeReference(delta.reference) ?? reference;
    }
  }
  return { text: stripMarkers(text).trim(), reference };
}
