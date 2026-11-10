import { config } from "./config.js";

/** RAGFlow answers with `{ code, message, data }`. A non-zero `code` is an error even on HTTP 200. */
export class RagflowError extends Error {
  constructor(message: string, public readonly code?: number, public readonly status?: number) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function call<T>(path: string, params?: Params): Promise<T> {
  const url = new URL(config.ragflowUrl + path);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new RagflowError(`Cannot reach RAGFlow at ${config.ragflowUrl}`);
  }
  const text = await res.text();
  let body: { code?: number; message?: string; data?: T };
  try { body = JSON.parse(text); } catch { throw new RagflowError(`Unexpected response (HTTP ${res.status})`, undefined, res.status); }
  if ((body.code !== undefined && body.code !== 0) || !res.ok) throw new RagflowError(body.message || `HTTP ${res.status}`, body.code, res.status);
  return body.data as T;
}

/** Raw document as RAGFlow returns it (only the fields we use). */
interface RFDoc {
  id: string; name: string; size: number; run: string; progress: number;
  chunk_count: number; create_time?: number; update_time?: number; progress_msg?: string | string[];
}

const STATUS: Record<string, string> = { DONE: "ready", RUNNING: "processing", SCHEDULE: "queued", UNSTART: "not_started", FAIL: "failed", CANCEL: "canceled" };

export const toDocument = (d: RFDoc) => ({
  id: d.id,
  name: d.name,
  size: d.size,
  status: STATUS[d.run] ?? d.run.toLowerCase(),
  progress: d.progress,
  chunkCount: d.chunk_count,
  createdAt: d.create_time ?? null,
  updatedAt: d.update_time ?? null,
});

let cachedDatasetId = config.datasetId;

/** The dataset id from the environment, or looked up by name once and remembered. */
export async function datasetId(): Promise<string> {
  if (cachedDatasetId) return cachedDatasetId;
  // RAGFlow answers code 102 when no dataset has that name; any other failure (network, auth) must surface.
  const found = await call<{ id: string }[]>("/api/v1/datasets", { name: config.datasetName, page: 1, page_size: 1 }).catch((e) => {
    if (e instanceof RagflowError && e.code === 102) return [];
    throw e;
  });
  const id = Array.isArray(found) ? found[0]?.id : undefined;
  if (!id) throw new RagflowError(`Dataset "${config.datasetName}" not found. Create it in RAGFlow or set DATASET_ID.`, 102, 404);
  return (cachedDatasetId = id);
}

export interface ListQuery { page: number; pageSize: number; keywords?: string; run?: string; id?: string }

/** GET /api/v1/datasets/{dataset_id}/documents */
export async function listDocuments(q: ListQuery) {
  const ds = await datasetId();
  const d = await call<{ docs?: RFDoc[]; total?: number }>(`/api/v1/datasets/${ds}/documents`, {
    page: q.page, page_size: q.pageSize, keywords: q.keywords, run: q.run, id: q.id, orderby: "create_time", desc: true,
  });
  return { documents: (d?.docs ?? []).map(toDocument), total: d?.total ?? null };
}

/** GET /api/v1/datasets: a cheap authenticated call used by the health check. */
export const ping = () => call("/api/v1/datasets", { page: 1, page_size: 1 });
