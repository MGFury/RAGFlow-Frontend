import { downloadDocument } from "./ragflow";
import { useUi } from "@/store";
import { translate } from "@/i18n";
import { useStore } from "@/store";

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the original file straight from RAGFlow. */
export async function downloadOriginal(id: string, name: string) {
  const { flash } = useUi.getState();
  flash(translate(useStore.getState().lang, "dlStart"));
  try { saveBlob(await downloadDocument(id), name); } catch (e) { flash((e as Error).message); }
}
