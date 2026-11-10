# Shaul backend (core)

A small Express + TypeScript server that sits between the browser and RAGFlow. The RAGFlow API key lives here,
in the environment, and never reaches the browser.

This is the base: configuration, a RAGFlow client, error handling, and one sample request (list documents).

## Run

```bash
cd backend
npm install
cp .env.example .env     # set RAGFLOW_URL and RAGFLOW_API_KEY
npm run dev              # http://localhost:3001
```

To try it without RAGFlow, start the mock from the repo root (`npm run mock`, listens on :9380) and use any API key.

## Endpoints

| Method | Path | What it does | RAGFlow call |
|---|---|---|---|
| GET | `/health` | Server up, and RAGFlow reachable with the key | `GET /api/v1/datasets` |
| GET | `/api/documents` | All documents in the dataset, paged | `GET /api/v1/datasets/{id}/documents` |
| GET | `/api/documents/:id` | One document | same, filtered by `id` |

`/api/documents` query: `page` (default 1), `pageSize` (default 30, max 100), `keywords`, and
`status` = `ready | processing | queued | not_started | failed | canceled`.

```bash
curl "localhost:3001/api/documents?pageSize=2&status=ready"
```

```json
{
  "documents": [
    { "id": "…", "name": "Data-Retention-Policy-v4.pdf", "size": 2336, "status": "ready", "progress": 1, "chunkCount": 90, "createdAt": 1794319076371, "updatedAt": 1794319082719 }
  ],
  "total": 6, "page": 1, "pageSize": 2
}
```

Errors: `400` bad query, `404` unknown document or dataset, `502` RAGFlow failed or is unreachable
(`{ "error": "…", "ragflowCode": 102 }`), `503` from `/health` when RAGFlow cannot be reached.

## Configuration (`.env`)

| Variable | Meaning |
|---|---|
| `RAGFLOW_URL` | RAGFlow API address, e.g. `http://localhost:9380` |
| `RAGFLOW_API_KEY` | API key created in RAGFlow |
| `DATASET_ID` | Dataset to read. If empty, it is looked up by `DATASET_NAME` (default `shaul-files`) |
| `PORT` | Default `3001` |
| `CORS_ORIGIN` | Allowed browser origin(s), comma separated. Default `http://localhost:5173` |

## Layout

```
src/config.ts    reads and checks the environment
src/ragflow.ts   RAGFlow client: auth, the { code, message, data } envelope, errors, listDocuments
src/server.ts    routes and error handling
```

Add a new RAGFlow call by writing one function in `ragflow.ts` and one route in `server.ts`.

## Build for production

```bash
npm run build && npm start     # runs dist/server.js
```

## Not done yet

Authentication of the people calling this API, upload, delete, processing control, chat with streaming and sources,
and per-chat file selection. The front end in the repo root already implements those against RAGFlow directly and can be
moved here one endpoint at a time.
