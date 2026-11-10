import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RagflowError, listDocuments, ping } from "./ragflow.js";
import { ragflowProxy } from "./proxy.js";

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use("/ragflow", ragflowProxy); // before the JSON parser: bodies are streamed through untouched
app.use(express.json());

/** Is the server up, and can it reach RAGFlow with the configured key? */
app.get("/health", async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, ragflow: "reachable" });
  } catch (e) {
    res.status(503).json({ ok: false, ragflow: (e as Error).message });
  }
});

/** The sample request: every document in the dataset, one page at a time.
 *  GET /api/documents?page=1&pageSize=30&keywords=policy&status=ready */
const RUN: Record<string, string> = { ready: "DONE", processing: "RUNNING", queued: "SCHEDULE", not_started: "UNSTART", failed: "FAIL", canceled: "CANCEL" };

app.get("/api/documents", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30)); // RAGFlow caps page_size at 100
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !RUN[status]) return res.status(400).json({ error: `status must be one of: ${Object.keys(RUN).join(", ")}` });
  const result = await listDocuments({
    page, pageSize,
    keywords: typeof req.query.keywords === "string" ? req.query.keywords : undefined,
    run: status ? RUN[status] : undefined,
  });
  res.json({ ...result, page, pageSize });
});

app.get("/api/documents/:id", async (req, res) => {
  const { documents } = await listDocuments({ page: 1, pageSize: 1, id: String(req.params.id) });
  if (!documents[0]) return res.status(404).json({ error: "Document not found" });
  res.json(documents[0]);
});

// The built front end (if present): static files, and index.html for any other page route.
const webDir = config.webDir;
if (existsSync(join(webDir, "index.html"))) {
  app.use(express.static(webDir));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api/") ? res.sendFile(join(webDir, "index.html")) : next()));
}

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Express 5 forwards rejected async handlers here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof RagflowError) return res.status(err.status === 404 ? 404 : 502).json({ error: err.message, ragflowCode: err.code ?? null });
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

app.listen(config.port, () => console.log(`Shaul backend on http://localhost:${config.port}  →  RAGFlow ${config.ragflowUrl}`));
