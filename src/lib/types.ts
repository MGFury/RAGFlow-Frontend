/** RAGFlow document processing state (`run`). */
export type RunStatus = "UNSTART" | "RUNNING" | "CANCEL" | "DONE" | "FAIL" | "SCHEDULE";

export interface RFDoc {
  id: string;
  name: string;
  size: number;
  run: RunStatus | string;
  progress: number;
  progress_msg?: string | string[];
  chunk_count: number;
  token_count?: number;
  create_time?: number;
  update_time?: number;
  suffix?: string;
  type?: string;
  meta_fields?: Record<string, unknown>;
}

export interface RefChunk {
  id: string;
  content: string;
  document_id: string;
  document_name: string;
  /** [page, x0, x1, top, bottom] per range, as returned by RAGFlow. */
  positions?: number[][];
  similarity?: number;
}

export interface RefAgg { doc_id: string; doc_name: string; count: number }
export interface Reference { chunks: RefChunk[]; doc_aggs: RefAgg[] }

export interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  reference?: Reference;
  /** Set when the request failed; shown in place of an answer. */
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  /** Document ids this chat may use. `null` means every ready file. */
  scope: string[] | null;
  messages: Msg[];
}

export interface UploadItem { key: string; name: string; progress: number; error?: string }
