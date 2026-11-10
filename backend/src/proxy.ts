import { Readable } from "node:stream";
import type { Request, Response as ExpressResponse } from "express";
import { config } from "./config.js";

/**
 * Forwards /ragflow/* to RAGFlow, so the browser app can use its own API key without CORS.
 * Bodies are streamed both ways: file uploads go up as they are, and streamed answers (SSE) come back as they are.
 * Mount it before any body parser.
 */
export async function ragflowProxy(req: Request, res: ExpressResponse) {
  const headers = new Headers();
  for (const h of ["authorization", "content-type", "accept"]) if (req.headers[h]) headers.set(h, String(req.headers[h]));
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  let upstream: Response;
  try {
    upstream = await fetch(config.ragflowUrl + req.url, {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as unknown as BodyInit) : undefined,
      // Node needs this when the request body is a stream.
      ...(hasBody ? { duplex: "half" } : {}),
      signal: abort.signal,
    } as RequestInit);
  } catch {
    if (!res.headersSent) res.status(502).json({ code: 105, message: `Cannot reach RAGFlow at ${config.ragflowUrl}` });
    return;
  }

  res.status(upstream.status);
  for (const h of ["content-type", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.body) return void res.end();
  Readable.fromWeb(upstream.body as never).on("error", () => res.end()).pipe(res);
}
