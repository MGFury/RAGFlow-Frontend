import type { RFDoc } from "./types";
import type { Key } from "@/i18n";

export const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export type UiStatus = "ready" | "parsing" | "queued" | "failed" | "canceled" | "idle";

/** Maps RAGFlow's `run` value (UNSTART, RUNNING, CANCEL, DONE, FAIL, SCHEDULE) to what the UI shows. */
export function statusOf(d: Pick<RFDoc, "run">): UiStatus {
  switch (d.run) {
    case "DONE": return "ready";
    case "RUNNING": return "parsing";
    case "SCHEDULE": return "queued";
    case "FAIL": return "failed";
    case "CANCEL": return "canceled";
    default: return "idle";
  }
}
export const statusKey = (s: UiStatus): Key => ({ ready: "st_ready", parsing: "st_parsing", queued: "st_queued", failed: "st_failed", canceled: "st_canceled", idle: "st_queued" }[s] as Key);

/** The last line RAGFlow logged while processing: the reason a file failed. */
export function lastMessage(d: RFDoc): string {
  const m = d.progress_msg;
  const lines = Array.isArray(m) ? m : String(m ?? "").split("\n");
  return lines.map((x) => x.trim()).filter(Boolean).pop() ?? "";
}

export function relTime(ms: number | undefined, t: (k: Key, v?: Record<string, string | number>) => string, lang: string) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("hrAgo", { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t("dayAgo", { n: day });
  return t("on", { d: new Date(ms).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" }) });
}

/** Page number for a citation: the first number of the first position RAGFlow returned. */
export function pageOf(positions?: number[][]): number | undefined {
  const p = positions?.[0]?.[0];
  return typeof p === "number" && p > 0 ? p : undefined;
}

export const fileLabel = (suffix?: string) => (suffix || "file").slice(0, 4).toUpperCase();
export const fileTone = (suffix?: string) =>
  ({ pdf: "bg-[#d93a30]", doc: "bg-[#2b6fe6]", docx: "bg-[#2b6fe6]", xls: "bg-[#1a9a4a]", xlsx: "bg-[#1a9a4a]", csv: "bg-[#1a9a4a]", md: "bg-[#0f94b5]", txt: "bg-[#6b776b]", ppt: "bg-[#e07a1f]", pptx: "bg-[#e07a1f]" })[(suffix ?? "").toLowerCase()] ?? "bg-[#6b776b]";
