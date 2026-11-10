import { chatStream, ensureResources, isAbort, tagDocuments, RagflowError } from "./ragflow";
import type { Msg } from "./types";
import { newId, useStore, useUi } from "@/store";
import { translate } from "@/i18n";

let controller: AbortController | null = null;

export const stopAsking = () => controller?.abort();

const failure = (e: unknown, lang: "he" | "en") =>
  e instanceof RagflowError && e.message === "NO_SETUP" ? translate(lang, "errNoSetup") : e instanceof Error ? e.message : translate(lang, "errGeneric");

/**
 * Sends the conversation to RAGFlow and stores the answer (with its sources) in the chat.
 * History is sent with every request, so chats live in this browser, not on the server.
 */
export async function ask(chatId: string, text?: string) {
  const store = useStore.getState();
  const ui = useUi.getState();
  const { lang } = store;
  if (!store.apiKey || !store.chatId) return ui.set({ settingsOpen: true });

  if (text) {
    store.patchChat(chatId, (c) => ({ ...c, title: c.title || text.slice(0, 48), messages: [...c.messages, { id: newId(), role: "user", content: text }] }));
  }
  const chat = useStore.getState().chats.find((c) => c.id === chatId);
  if (!chat) return;
  const history = chat.messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
  if (history.at(-1)?.role !== "user") return;

  controller?.abort();
  const mine = (controller = new AbortController());
  useUi.setState({ streaming: { chatId, text: "" } });
  let partial = "";
  try {
    await ensureResources(lang);
    if (chat.scope) await tagDocuments(chat.scope);
    const r = await chatStream({
      messages: history,
      scope: chat.scope,
      signal: mine.signal,
      onText: (full) => { partial = full; useUi.setState({ streaming: { chatId, text: full } }); },
    });
    useStore.getState().addMessages(chatId, { id: newId(), role: "assistant", content: r.text, reference: r.reference });
  } catch (e) {
    const msgs: Msg[] = [];
    if (isAbort(e)) { if (partial) msgs.push({ id: newId(), role: "assistant", content: partial }); }
    else msgs.push({ id: newId(), role: "assistant", content: partial, error: failure(e, lang) });
    if (msgs.length) useStore.getState().addMessages(chatId, ...msgs);
  } finally {
    if (controller === mine) { controller = null; useUi.setState({ streaming: null }); }
  }
}

/** Drops the last answer and asks again with the same question. */
export function regenerate(chatId: string) {
  useStore.getState().patchChat(chatId, (c) => {
    const msgs = [...c.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    return { ...c, messages: msgs };
  });
  return ask(chatId);
}
