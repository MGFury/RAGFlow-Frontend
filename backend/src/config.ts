function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  ragflowUrl: required("RAGFLOW_URL").replace(/\/+$/, ""),
  apiKey: required("RAGFLOW_API_KEY"),
  datasetId: process.env.DATASET_ID?.trim() || "",
  datasetName: process.env.DATASET_NAME?.trim() || "shaul-files",
  port: Number(process.env.PORT) || 3001,
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
};
