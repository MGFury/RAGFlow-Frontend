// Development-only stand-in for RAGFlow's HTTP API (the endpoints this app uses), so the UI can be
// exercised without a RAGFlow install. It follows the shapes in the official API reference.
//   node mock/server.mjs         → http://localhost:9380
//   npm run dev   (default proxy target is :9380)
import http from "node:http";

const PORT = Number(process.env.PORT || 9380);
const id = () => Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10) + "ab";

/* ───────── A tiny PDF writer (ASCII only), with known text positions for citations ───────── */
function wrap(text, n = 86) {
  const out = []; let line = "";
  for (const w of text.split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line); line = w; } else line = (line + " " + w).trim(); }
  if (line) out.push(line);
  return out;
}
function makePdf(pages) {
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(""), pagesObj = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const kids = [];
  for (const p of pages) {
    let y = 730; let s = `BT /F2 8 Tf 54 760 Td (${esc(p.header)}) Tj ET\nBT /F2 18 Tf 54 ${y} Td (${esc(p.title)}) Tj ET\n`; y -= 34;
    p.spans = [];
    for (const para of p.paras) {
      const lines = wrap(para.text); const top = y + 11;
      for (const l of lines) { s += `BT /F1 11 Tf 54 ${y} Td (${esc(l)}) Tj ET\n`; y -= 16; }
      if (para.hit) p.spans.push({ top: 792 - top, bottom: 792 - (y + 16 - 4), x0: 52, x1: 560 });
      y -= 10;
    }
    const c = add(`<< /Length ${s.length} >>\nstream\n${s}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Contents ${c} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
const esc = (s) => s.replace(/([()\\])/g, "\\$1");

const FILLER = ["Records are classified when they are created and handled according to their sensitivity.", "Access is limited to staff who need it for their role and is reviewed every quarter.", "Exports of personal data leave the company only through approved channels.", "Backups follow the same retention schedule as the systems they protect.", "Exceptions are documented, time-limited and approved by the data owner.", "Vendors that process data on our behalf sign the standard processing agreement."];
function seedPdf(name, hitPage, title, before, hit, pageCount) {
  const pages = Array.from({ length: pageCount }, (_, i) => {
    const n = i + 1;
    const paras = n === hitPage ? [{ text: before }, { text: hit, hit: true }, { text: FILLER[n % 6] }] : [{ text: FILLER[(n * 2) % 6] }, { text: FILLER[(n * 2 + 1) % 6] + " " + FILLER[(n * 2 + 3) % 6] }];
    return { header: name, title: n === hitPage ? title : `${n}. ${["Purpose and scope", "Definitions", "Roles", "Classification", "Retention", "Access", "Deletion"][n % 7]}`, paras };
  });
  const buf = makePdf(pages);
  const span = pages[hitPage - 1].spans[0];
  return { buf, hit: { text: hit, page: hitPage, span } };
}

/* ───────── In-memory state ───────── */
const datasets = []; const chats = []; const docs = new Map(); // id -> { meta, buf, dataset }

function newDoc(ds, name, buf, run = "DONE", extra = {}) {
  const d = { id: id(), name, size: buf.length, run, progress: run === "DONE" ? 1 : 0, progress_msg: "", chunk_count: run === "DONE" ? 20 + Math.floor(Math.random() * 120) : 0, token_count: 0, create_time: Date.now(), update_time: Date.now(), meta_fields: {}, type: "doc", dataset_id: ds, ...extra };
  docs.set(d.id, { meta: d, buf, ds });
  return d;
}
const SEEDS = {};
function seed() {
  const ds = { id: id(), name: "shaul-files", language: "English", document_count: 0 };
  datasets.push(ds);
  const defs = [
    ["Data-Retention-Policy-v4.pdf", 4, "7.3 Customer support recordings", "Operational records are retained only as long as a documented business purpose exists.", "Recordings of customer support calls are retained for 90 days from the date of the call and then deleted automatically. Payment card details spoken during a call must be redacted within 24 hours.", 6],
    ["Support-Handbook.pdf", 3, "4.2 Holds and escalations", "Agents never download or share recordings outside the quality tool.", "A recording flagged for quality or legal review may be held for up to 12 months. A hold needs written approval from Legal and is logged in the review register.", 5],
    ["GDPR-Addendum-2026.pdf", 2, "2.1 Storage limitation", "For customers in the European Economic Area, the following limits replace the general schedule.", "Call recordings are deleted when the related ticket is closed, unless the customer has given consent to a longer period in writing.", 4],
  ];
  for (const [name, page, title, before, hit, count] of defs) {
    const s = seedPdf(name, page, title, before, hit, count);
    const d = newDoc(ds.id, name, s.buf);
    SEEDS[d.id] = { ...s.hit, name };
  }
  newDoc(ds.id, "Q3-Audit-Notes.md", Buffer.from("# Q3 audit notes\n\n- Backup restore test passed\n- Access review **in progress**\n- Penetration test missing\n"), "DONE");
  const slow = newDoc(ds.id, "Incident-Response-Plan.pdf", seedPdf("Incident-Response-Plan.pdf", 1, "Response plan", "x", "Contain, assess, notify, recover.", 3).buf, "UNSTART");
  startParse(slow.id);
  newDoc(ds.id, "Scanned-Policy-1998.pdf", seedPdf("Scanned-Policy-1998.pdf", 1, "Scan", "x", "n/a", 1).buf, "FAIL", { progress_msg: ["10:01:02 Task has been received.", "10:01:05 No text could be extracted: the file looks like a scan."] });
  chats.push({ id: id(), name: "Shaul", dataset_ids: [ds.id] });
}

const timers = new Map();
function startParse(docId) {
  const rec = docs.get(docId); if (!rec) return;
  clearInterval(timers.get(docId));
  rec.meta.run = "RUNNING"; rec.meta.progress = 0.04; rec.meta.progress_msg = "Task has been received.";
  timers.set(docId, setInterval(() => {
    rec.meta.progress = Math.min(1, rec.meta.progress + 0.08 + Math.random() * 0.07);
    if (rec.meta.progress >= 1) {
      clearInterval(timers.get(docId));
      if (/scan/i.test(rec.meta.name)) { rec.meta.run = "FAIL"; rec.meta.progress_msg = "No text could be extracted: the file looks like a scan."; }
      else { rec.meta.run = "DONE"; rec.meta.chunk_count = 20 + Math.floor(Math.random() * 120); rec.meta.progress_msg = "Task done."; }
    }
    rec.meta.update_time = Date.now();
  }, 700));
}

/* ───────── HTTP helpers ───────── */
const send = (res, body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const ok = (res, data) => send(res, { code: 0, data });
const fail = (res, code, message, status = 200) => send(res, { code, message }, status);
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const json = async (req) => { try { return JSON.parse((await readBody(req)).toString() || "{}"); } catch { return {}; } };

function parseMultipart(buf, ctype) {
  const boundary = "--" + /boundary=(.+)$/.exec(ctype)[1];
  const parts = []; let pos = buf.indexOf(boundary);
  while (pos >= 0) {
    const next = buf.indexOf(boundary, pos + boundary.length); if (next < 0) break;
    const part = buf.subarray(pos + boundary.length + 2, next - 2);
    const he = part.indexOf("\r\n\r\n"); const head = part.subarray(0, he).toString();
    const fn = /filename="([^"]*)"/.exec(head); if (fn) parts.push({ name: Buffer.from(fn[1], "latin1").toString("utf8"), data: part.subarray(he + 4) });
    pos = next;
  }
  return parts;
}

const MIME = { pdf: "application/pdf", md: "text/markdown", txt: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

/* ───────── Chat (OpenAI-compatible, streamed, with reference) ───────── */
async function chat(req, res) {
  const b = await json(req);
  const last = [...(b.messages ?? [])].reverse().find((m) => m.role === "user");
  if (!last || b.messages.at(-1).role !== "user") return fail(res, 102, "The last content of this conversation is not from user.");
  const cond = b.extra_body?.metadata_condition;
  const allowed = cond ? new Set(cond.conditions.map((c) => c.value)) : null;
  const usable = [...docs.values()].filter((r) => r.meta.run === "DONE" && SEEDS[r.meta.id] && (!allowed || allowed.has(r.meta.meta_fields.file_id)));
  const he = /[֐-׿]/.test(last.content);
  const text = !usable.length
    ? "לא מצאתי תשובה בקבצים שנבחרו. / I could not find an answer in the selected files."
    : he
      ? "הקלטות של שיחות תמיכה נשמרות במשך **90 יום** ואז נמחקות אוטומטית. הקלטה שסומנה לבדיקה משפטית ניתן להחזיק עד **12 חודשים**, באישור בכתב של הצוות המשפטי.\n\nחלות שתי חריגות:\n\n- לקוחות באזור הכלכלי האירופי: ההקלטה נמחקת עם סגירת הפנייה.\n- פרטי כרטיס אשראי חייבים להימחק תוך 24 שעות."
      : "Support call recordings are kept for **90 days**, then deleted automatically. A recording flagged for legal review can be held for up to **12 months**, with written approval from Legal.\n\nTwo exceptions apply:\n\n- EEA customers: the recording is deleted when the ticket closes.\n- Payment card details must be redacted within 24 hours.";
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const chunk = (delta) => `data: ${JSON.stringify({ id: "chatcmpl-mock", object: "chat.completion.chunk", model: "model", choices: [{ delta, finish_reason: null, index: 0 }] })}\n\n`;
  await new Promise((r) => setTimeout(r, 700));
  for (const w of text.split(/(?<= )/)) { res.write(chunk({ content: w })); await new Promise((r) => setTimeout(r, 25)); }
  if (usable.length) {
    const chunks = {}; const aggs = {};
    usable.forEach((r, i) => {
      const s = SEEDS[r.meta.id]; const sp = s.span;
      chunks[i] = { id: id(), content: s.text, document_id: r.meta.id, document_name: r.meta.name, dataset_id: r.ds, positions: [[s.page, sp.x0 * 3, sp.x1 * 3, sp.top * 3, sp.bottom * 3]], similarity: 0.94 - i * 0.07, vector_similarity: 0.9, term_similarity: 0.8 };
      aggs[r.meta.name] = { doc_name: r.meta.name, doc_id: r.meta.id, count: 1 };
    });
    res.write(chunk({ content: "", reference: { chunks, doc_aggs: aggs } }));
  }
  res.write("data: [DONE]\n\n"); res.end();
}

/* ───────── Router ───────── */
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"); const p = url.pathname; const m = req.method;
  if (!/^Bearer .+/.test(req.headers.authorization ?? "")) return fail(res, 109, "Authentication error: API key is invalid!", 401);
  let r;
  try {
    if ((r = p.match(/^\/api\/v1\/datasets$/))) {
      if (m === "GET") { const n = url.searchParams.get("name"); const l = datasets.filter((d) => !n || d.name === n); return l.length || !n ? ok(res, l) : fail(res, 102, "You don't own the dataset."); }
      if (m === "POST") { const b = await json(req); const d = { id: id(), name: b.name, language: b.language }; datasets.push(d); return ok(res, d); }
    }
    if ((r = p.match(/^\/api\/v1\/chats$/))) {
      if (m === "GET") { const n = url.searchParams.get("name"); const l = chats.filter((c) => !n || c.name === n); return ok(res, l); }
      if (m === "POST") { const b = await json(req); const c = { id: id(), ...b }; chats.push(c); return ok(res, c); }
    }
    if ((r = p.match(/^\/api\/v1\/datasets\/([^/]+)\/documents$/))) {
      const ds = r[1];
      if (m === "GET") {
        const q = url.searchParams; const kw = (q.get("keywords") ?? "").toLowerCase(); const runs = q.getAll("run"); const only = q.get("id");
        const page = +(q.get("page") ?? 1), size = +(q.get("page_size") ?? 30);
        const all = [...docs.values()].filter((x) => x.ds === ds).map((x) => x.meta).filter((d) => (!kw || d.name.toLowerCase().includes(kw)) && (!runs.length || runs.includes(d.run)) && (!only || d.id === only)).sort((a, b) => b.create_time - a.create_time);
        return ok(res, { docs: all.slice((page - 1) * size, page * size), total: all.length });
      }
      if (m === "POST") {
        const files = parseMultipart(await readBody(req), req.headers["content-type"] ?? "");
        if (!files.length) return fail(res, 101, "No file part!");
        return ok(res, files.map((f) => newDoc(ds, f.name, f.data, "UNSTART")));
      }
      if (m === "DELETE") { const b = await json(req); (b.ids ?? []).forEach((i) => { clearInterval(timers.get(i)); docs.delete(i); }); return ok(res, null); }
    }
    if ((r = p.match(/^\/api\/v1\/datasets\/([^/]+)\/documents\/([^/]+)$/))) {
      const rec = docs.get(r[2]); if (!rec) return fail(res, 102, "Document not found!");
      if (m === "GET") { const ext = rec.meta.name.split(".").pop().toLowerCase(); res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" }); return res.end(rec.buf); }
      if (m === "PATCH") { const b = await json(req); if (b.meta_fields) rec.meta.meta_fields = b.meta_fields; return ok(res, rec.meta); }
    }
    if ((r = p.match(/^\/api\/v1\/datasets\/([^/]+)\/chunks$/))) {
      const b = await json(req);
      if (m === "POST") { (b.document_ids ?? []).forEach(startParse); return send(res, { code: 0 }); }
      if (m === "DELETE") { (b.document_ids ?? []).forEach((i) => { clearInterval(timers.get(i)); const d = docs.get(i); if (d) d.meta.run = "CANCEL"; }); return send(res, { code: 0 }); }
    }
    if ((r = p.match(/^\/api\/v1\/openai\/([^/]+)\/chat\/completions$/)) && m === "POST") return chat(req, res);
    fail(res, 404, `Not found: ${m} ${p}`, 404);
  } catch (e) { fail(res, 500, String(e), 500); }
}).listen(PORT, () => console.log(`Mock RAGFlow on http://localhost:${PORT}  (use any API key)`));

seed();
