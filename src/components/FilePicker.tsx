import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { RFDoc } from "@/lib/types";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { FileTile, LinkBtn } from "./ui";
import { useUi } from "@/store";

interface Props {
  docs: RFDoc[];
  /** Selected document ids. `null` means every ready file. */
  scope: string[] | null;
  onChange: (scope: string[] | null) => void;
  heading: string;
  sub?: string;
  className?: string;
}

const TYPES = ["pdf", "docx", "xlsx", "md"];

/** Choose which files a chat may use. Search, type chips and "selected only" keep 100+ files manageable. */
export function FilePicker({ docs, scope, onChange, heading, sub, className }: Props) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [only, setOnly] = useState(false);

  const selected = useMemo(() => new Set(scope ?? docs.map((d) => d.id)), [scope, docs]);
  const filtering = !!(q || types.length || only);
  const visible = useMemo(
    () => docs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()) && (!types.length || types.includes(d.suffix ?? "")) && (!only || selected.has(d.id))),
    [docs, q, types, only, selected],
  );

  const commit = (s: Set<string>) => onChange(s.size === docs.length ? null : [...s]);
  const toggle = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); commit(s); };
  const big = docs.length > 8;

  return (
    <section className={cn("overflow-hidden rounded-lg bg-surface shadow-[inset_0_0_0_1px_var(--line)]", className)}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0 flex-1">
          <b className="block text-sm font-semibold">{heading}</b>
          {sub && <small className="text-[12.5px] text-ink3">{sub}</small>}
        </div>
        <span className="font-mono text-xs whitespace-nowrap text-ink3">{t("pickCount", { n: selected.size, m: docs.length })}</span>
      </div>
      <div className="grid gap-2 px-3 pb-2.5">
        <label className="flex h-9 items-center gap-2.5 rounded-full bg-surface2 px-3.5 text-ink3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--accent-ring)]">
          <Search size={15} />
          <span className="sr-only">{t("pickSearch")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pickSearch")} className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink3" />
        </label>
        {big && (
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((k) => (
              <Chip key={k} on={types.includes(k)} onClick={() => setTypes((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]))}>{k.toUpperCase()}</Chip>
            ))}
            <Chip on={only} onClick={() => setOnly((v) => !v)}>{t("onlySel")}</Chip>
          </div>
        )}
        <div className="-mx-2.5 flex gap-1">
          <LinkBtn onClick={() => { const s = new Set(selected); visible.forEach((d) => s.add(d.id)); commit(s); }}>{t(filtering ? "selVisible" : "selAll")}</LinkBtn>
          <LinkBtn onClick={() => onChange([])}>{t("clearAll")}</LinkBtn>
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto border-t border-line px-1.5 pt-1 pb-2" role="group">
        {visible.length === 0 ? (
          <p className="p-4 text-ink3">{docs.length ? t("noMatch") : t("noReady")}</p>
        ) : (
          visible.map((d) => {
            const on = selected.has(d.id);
            return (
              <button key={d.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(d.id)}
                className={cn("press flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start [@media(hover:hover)]:hover:bg-surface2", on ? "text-ink" : "text-ink2")}>
                <span className={cn("grid size-[22px] flex-none place-items-center rounded-full transition-colors", on ? "bg-acid text-acidink" : "text-transparent shadow-[inset_0_0_0_1.5px_var(--line-strong)]")}>
                  <Check size={13} strokeWidth={2.8} />
                </span>
                <FileTile suffix={d.suffix} size="sm" />
                <span className="min-w-0 truncate font-medium"><bdi>{d.name}</bdi></span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Chip({ on, ...p }: { on: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={on} {...p}
      className={cn("press h-7 rounded-full px-3 text-xs font-semibold", on ? "bg-wash2 text-accent shadow-[inset_0_0_0_1px_var(--accent-ring)]" : "bg-surface2 text-ink2 shadow-[inset_0_0_0_1px_var(--line)]")} />
  );
}

export function NoFilesHint() {
  const { t } = useT();
  const set = useUi((s) => s.set);
  return (
    <p className="rounded-lg bg-surface p-4 text-ink2 shadow-[inset_0_0_0_1px_var(--line)]">
      {t("noReady")}{" "}
      <button className="font-semibold text-accent underline underline-offset-4" onClick={() => set({ view: "files" })}>{t("goFiles")}</button>
    </p>
  );
}
