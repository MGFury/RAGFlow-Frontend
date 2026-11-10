import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Copy, FileText, RotateCcw, Square } from "lucide-react";
import { useStore, useUi } from "@/store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { ask, regenerate, stopAsking } from "@/lib/chat";
import { renderMarkdown } from "@/lib/markdown";
import type { Chat, Msg } from "@/lib/types";
import { useReadyDocs } from "@/hooks";
import { FilePicker, NoFilesHint } from "./FilePicker";
import { BrandMark } from "./Sidebar";
import { TopBar } from "./TopBar";
import { FileTile, IconBtn } from "./ui";


export function ChatView() {
  const { t } = useT();
  const chat = useStore((s) => s.chats.find((c) => c.id === s.activeChatId));
  const streaming = useUi((s) => s.streaming);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // A chat always exists while this view is open.
  useEffect(() => { if (!chat) useStore.getState().newChat(); }, [chat]);

  const live = streaming && chat && streaming.chatId === chat.id ? streaming : null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight });
  }, [chat?.messages.length, live?.text]);

  if (!chat) return null;
  const empty = chat.messages.length === 0 && !live;

  return (
    <section className="absolute inset-0 flex min-h-0 flex-col">
      <TopBar title={chat.title || t("untitled")} />
      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
        className="min-h-0 flex-1 overflow-y-auto px-7 pt-[88px] pb-[210px] max-[900px]:px-4 max-[900px]:pt-20 max-[900px]:pb-[240px]">
        <div className="mx-auto grid max-w-[740px] gap-7">
          {empty ? <EmptyState chat={chat} /> : chat.messages.map((m, i) => (
            <Message key={m.id} m={m} chatId={chat.id} last={i === chat.messages.length - 1 && !live} />
          ))}
          {live && <Assistant text={live.text} streaming />}
        </div>
      </div>
      <Composer chat={chat} busy={!!live} />
    </section>
  );
}

function EmptyState({ chat }: { chat: Chat }) {
  const { t } = useT();
  const { docs, loading } = useReadyDocs();
  const patch = useStore((s) => s.patchChat);
  return (
    <div className="mx-auto mt-[9vh] w-full max-w-[600px]">
      <h2 className="mb-2.5 text-[34px] leading-[1.15] font-bold">{t("eH")}</h2>
      <p className="mb-6 text-base text-ink2">{t("eP")}</p>
      {!loading && docs.length === 0 ? <NoFilesHint /> : (
        <FilePicker docs={docs} scope={chat.scope} heading={t("pickT")} sub={t("pickS")} onChange={(scope) => patch(chat.id, (c) => ({ ...c, scope }))} />
      )}
    </div>
  );
}

function Message({ m, chatId, last }: { m: Msg; chatId: string; last: boolean }) {
  if (m.role === "user") return <div className="justify-self-end rounded-[22px] rounded-ee-md bg-ink px-[18px] py-[11px] text-[15px] leading-normal break-words text-canvas max-[900px]:max-w-[92%] md:max-w-[82%]">{m.content}</div>;
  return <Assistant text={m.content} msg={m} chatId={chatId} last={last} />;
}

function Assistant({ text, msg, chatId, streaming, last }: { text: string; msg?: Msg; chatId?: string; streaming?: boolean; last?: boolean }) {
  const { t } = useT();
  const set = useUi((s) => s.set);
  const flash = useUi((s) => s.flash);
  const html = useMemo(() => renderMarkdown(text), [text]);
  const sources = msg?.reference?.doc_aggs ?? [];
  return (
    <div className="animate-rise text-[15.5px]">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink2"><BrandMark size={16} />{t("brand")}</div>
      {streaming && !text && (
        <div role="status" className="relative pb-2.5 text-[13.5px] text-ink2">
          {t("searching")}
          <span className="absolute inset-x-0 bottom-0 h-0.5 animate-scan rounded-sm bg-[linear-gradient(90deg,transparent,var(--acid),transparent)] bg-[length:45%_100%] bg-no-repeat" />
        </div>
      )}
      {text && <div className="prose-chat break-words" dir="auto" dangerouslySetInnerHTML={{ __html: html }} />}
      {msg?.error && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-surface px-4 py-3 text-danger shadow-[inset_0_0_0_1px_var(--danger)]">
          <span className="flex-1">{msg.error}</span>
          {chatId && last && <button className="press font-semibold underline underline-offset-4" onClick={() => regenerate(chatId)}>{t("retry")}</button>}
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="pe-1 text-xs font-semibold text-ink3">{t("sources")}</span>
          {sources.map((a) => (
            <button key={a.doc_id} type="button" onClick={() => set({ panel: { docId: a.doc_id, from: "chat", msgId: msg!.id } })}
              className="press flex h-9 max-w-full items-center gap-2 rounded-full bg-surface ps-1.5 pe-3.5 text-[13px] font-medium text-ink2 shadow-[inset_0_0_0_1px_var(--line)] [@media(hover:hover)]:hover:text-ink [@media(hover:hover)]:hover:shadow-[inset_0_0_0_1px_var(--line-strong)]">
              <FileTile suffix={a.doc_name.split(".").pop()} size="xs" />
              <span className="truncate"><bdi>{a.doc_name}</bdi></span>
            </button>
          ))}
        </div>
      )}
      {msg && !streaming && text && (
        <div className="-ms-2 mt-2 flex gap-0.5">
          <IconBtn className="size-8" aria-label={t("copy")} onClick={() => { navigator.clipboard?.writeText(text); flash(t("copied")); }}><Copy size={16} /></IconBtn>
          {chatId && last && <IconBtn className="size-8" aria-label={t("regen")} onClick={() => regenerate(chatId)}><RotateCcw size={16} /></IconBtn>}
        </div>
      )}
    </div>
  );
}

function Composer({ chat, busy }: { chat: Chat; busy: boolean }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const { docs } = useReadyDocs();
  const patch = useStore((s) => s.patchChat);
  const readyIds = useMemo(() => new Set(docs.map((d) => d.id)), [docs]);
  // Files that were deleted or are no longer ready drop out of the scope.
  const scope = chat.scope ? chat.scope.filter((id) => readyIds.has(id) || docs.length === 0) : null;
  const none = scope !== null && scope.length === 0;

  useEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; } }, [text]);
  useEffect(() => { ta.current?.focus(); }, [chat.id]);

  const send = () => {
    const q = text.trim();
    if (!q || none || busy) return;
    setText("");
    void ask(chat.id, q);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas from-30% to-transparent px-6 pt-12 pb-5 max-[900px]:px-3 max-[900px]:pb-[calc(84px+env(safe-area-inset-bottom))]">
      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="glass pointer-events-auto mx-auto max-w-[740px] rounded-[28px] p-3 ps-5 transition-shadow focus-within:shadow-[var(--shadow-float),inset_0_0.5px_0_var(--glass-edge),0_0_0_1.5px_var(--accent-ring)]">
        <label className="sr-only" htmlFor="prompt">{t("askPh")}</label>
        <textarea id="prompt" ref={ta} rows={1} value={text} placeholder={t("askPh")} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          className="block max-h-[140px] w-full resize-none bg-transparent py-1.5 text-[15.5px] leading-normal outline-none placeholder:text-ink3" />
        <div className="mt-1 flex items-center gap-1.5">
          <ScopeChip chat={chat} docsCount={docs.length} scope={scope} none={none} onChange={(s) => patch(chat.id, (c) => ({ ...c, scope: s }))} docs={docs} />
          <small className="truncate text-xs text-ink3 max-[600px]:hidden">{t("hint")}</small>
          <span className="flex-1" />
          {busy ? (
            <button type="button" aria-label={t("stop")} onClick={stopAsking} className="press grid size-[38px] place-items-center rounded-full bg-ink text-canvas"><Square size={14} fill="currentColor" /></button>
          ) : (
            <button type="submit" aria-label={t("send")} disabled={!text.trim() || none}
              className="press grid size-[38px] place-items-center rounded-full bg-acid text-acidink disabled:pointer-events-none disabled:opacity-30 [@media(hover:hover)]:hover:brightness-[1.07]"><ArrowUp size={18} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function ScopeChip({ docs, docsCount, scope, none, onChange }: { chat: Chat; docs: ReturnType<typeof useReadyDocs>["docs"]; docsCount: number; scope: string[] | null; none: boolean; onChange: (s: string[] | null) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const label = none ? t("chipNone") : scope === null || scope.length === docsCount ? t("chipAll") : t("chipN", { n: scope.length });
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={cn("press inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium", none ? "text-danger shadow-[inset_0_0_0_1px_var(--danger)]" : "bg-white/[0.06] text-ink2 shadow-[inset_0_0_0_1px_var(--line)] light:bg-white/70")}>
        <FileText size={15} />{label}<ChevronDown size={13} />
      </button>
      <div role="dialog" className={cn("absolute start-0 bottom-[calc(100%+10px)] z-10 w-[340px] max-w-[calc(100vw-24px)] origin-bottom-left rounded-lg bg-canvas2 p-1 shadow-[var(--shadow-float),inset_0_0_0_1px_var(--line-strong)] transition duration-150 ease-out-strong rtl:origin-bottom-right",
        open ? "scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-[0.96] opacity-0")}>
        {open && (docs.length ? <FilePicker docs={docs} scope={scope} heading={t("popT")} onChange={onChange} className="!bg-transparent !shadow-none" /> : <NoFilesHint />)}
      </div>
    </div>
  );
}
