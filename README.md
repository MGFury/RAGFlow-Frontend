# שאול (Shaul)

A chat-with-your-documents interface for [RAGFlow](https://github.com/infiniflow/ragflow). Hebrew (RTL) and English, dark and light.
It is a pure front end: the browser talks to the RAGFlow HTTP API directly. There is no backend of our own.

React 19 · Vite · TypeScript · Tailwind CSS v4 · zustand · pdf.js · docx-preview · read-excel-file

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

On first launch the app asks for the RAGFlow connection (API address and API key). It then finds or creates a dataset
(`shaul-files`) and a chat assistant (`Shaul`) and remembers their ids. Both can also be entered by hand in the same dialog.

### CORS: why there is a proxy

RAGFlow does not send CORS headers, so the browser cannot call it from another origin. The app therefore defaults to the
address `/ragflow`, which the dev server (and the production nginx below) forwards to RAGFlow:

```bash
RAGFLOW_TARGET=http://your-ragflow-host:9380 npm run dev
```

You can type a full URL in the settings instead if your RAGFlow is configured for CORS.

### Try it without RAGFlow

```bash
npm run mock       # fake RAGFlow API on :9380 with a few PDFs, streaming answers and citations
npm run dev
```

The mock (`mock/server.mjs`) is for development only. Use any API key.

## Production

```bash
docker build -t shaul .
docker run -p 8080:80 -e RAGFLOW_UPSTREAM=http://ragflow-host:9380 shaul
```

nginx serves the static build and forwards `/ragflow/*` to `RAGFLOW_UPSTREAM` (`nginx.conf.template`).

## What uses which RAGFlow endpoint

| Feature | Endpoint |
|---|---|
| Connect, find/create dataset | `GET/POST /api/v1/datasets` |
| Find/create the chat assistant | `GET/POST /api/v1/chats` |
| File list, search, status filter, paging | `GET /api/v1/datasets/{id}/documents` (`keywords`, `run`, `suffix`, `page`) |
| Upload (with progress) | `POST /api/v1/datasets/{id}/documents` |
| Start / retry processing | `POST /api/v1/datasets/{id}/chunks` (falls back to `POST /api/v1/documents/ingest`) |
| Stop processing | `DELETE /api/v1/datasets/{id}/chunks` |
| Delete a file | `DELETE /api/v1/datasets/{id}/documents` |
| View / download original | `GET /api/v1/datasets/{id}/documents/{doc_id}` |
| Answers (streamed) with sources | `POST /api/v1/openai/{chat_id}/chat/completions` (`reference: true`) |
| Choose files per chat | `PATCH …/documents/{doc_id}` (`meta_fields.file_id`) + `extra_body.metadata_condition` |

Processing status follows RAGFlow's `run` values: `UNSTART`, `RUNNING`, `SCHEDULE`, `DONE`, `FAIL`, `CANCEL`.

## Things to know

- **The API key lives in the browser** (localStorage). Use this for a private deployment, not a public site.
- **Chat history is stored in the browser**, not on RAGFlow. The whole conversation is sent with each request.
- **Per-chat file selection** works by writing `file_id = <document id>` into each document's metadata the first time it is
  needed, then sending an `or` filter over the chosen ids. "All files" sends no filter. Please verify with your RAGFlow
  version and a large selection; the reference does not state a limit on the number of conditions.
- **Citations are shown as sources under the answer**, built from the `reference` RAGFlow returns (`doc_aggs`, `chunks`).
  RAGFlow's own inline markers (`##0$$`) are stripped, not rendered.
- **Highlight on the PDF page** assumes RAGFlow's `positions` are `[page, x0, x1, top, bottom]` at 3x PDF points
  (`POSITION_ZOOM` in `src/components/Viewer.tsx`). If your version differs, the page jump still works; set the constant to `0`
  to switch the rectangles off.
- Page jump and highlight apply to PDFs. Word, Excel, Markdown, text and images open in the viewer without a page jump.
