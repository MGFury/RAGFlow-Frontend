function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v;
}

import { resolve } from "node:path";

export const config = {
  /** Folder with the built front end. Defaults to ../web next to the compiled server (the standalone bundle layout). */
  webDir: process.env.WEB_DIR?.trim() || resolve(import.meta.dirname, "../web"),
  ragflowUrl: required("RAGFLOW_URL").replace(/\/+$/, ""),
  apiKey: required("RAGFLOW_API_KEY"),
  datasetId: process.env.DATASET_ID?.trim() || "",
  datasetName: process.env.DATASET_NAME?.trim() || "shaul-files",
  port: Number(process.env.PORT) || 3001,
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
};
