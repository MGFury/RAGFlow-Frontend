import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { IconBtn } from "./ui";
import { useT } from "@/i18n";
import { useUi } from "@/store";

/** Floating glass bar over scrolling content. */
export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { t } = useT();
  const set = useUi((s) => s.set);
  return (
    <div className="glass absolute inset-x-3.5 top-3 z-[5] flex h-[52px] items-center gap-1.5 rounded-full ps-4 pe-2 max-[900px]:inset-x-2.5">
      <IconBtn className="hidden max-[900px]:grid" aria-label={t("openNav")} onClick={() => set({ navOpen: true })}><Menu size={18} /></IconBtn>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
      {children}
      <IconBtn aria-label={t("cmdAria")} onClick={() => set({ cmdOpen: true })}><Search size={18} /></IconBtn>
    </div>
  );
}
