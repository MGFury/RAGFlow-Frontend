import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fileLabel, fileTone } from "@/lib/format";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" };

export function Btn({ variant = "quiet", className, type = "button", ...p }: BtnProps) {
  return (
    <button
      type={type}
      {...p}
      className={cn(
        "press inline-flex h-[38px] items-center justify-center gap-2 rounded-full px-[18px] text-[13.5px] font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-acid text-acidink [@media(hover:hover)]:hover:brightness-[1.07]",
        variant === "quiet" && "bg-surface2 text-ink shadow-[inset_0_0_0_1px_var(--line)] [@media(hover:hover)]:hover:bg-surface",
        variant === "ghost" && "text-ink2 [@media(hover:hover)]:hover:bg-wash [@media(hover:hover)]:hover:text-ink",
        className,
      )}
    />
  );
}

export function IconBtn({ className, type = "button", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...p}
      className={cn(
        "press grid size-9 flex-none place-items-center rounded-full text-ink2 disabled:pointer-events-none disabled:opacity-35 [@media(hover:hover)]:hover:bg-wash [@media(hover:hover)]:hover:text-ink",
        className,
      )}
    />
  );
}

export function LinkBtn({ className, type = "button", ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} {...p} className={cn("press rounded-full px-3 py-1.5 text-[13px] font-semibold text-accent [@media(hover:hover)]:hover:bg-wash", className)} />
  );
}

const TILE = { md: "h-10 w-9 text-[9.5px] pb-1.5 rounded-[9px]", sm: "h-7 w-6 text-[7px] pb-1 rounded-md", xs: "h-6 w-5 text-[6px] pb-[3px] rounded-md" };

/** A document glyph tinted by file type. */
export function FileTile({ suffix, size = "md" }: { suffix?: string; size?: keyof typeof TILE }) {
  return (
    <div dir="ltr" className={cn("relative grid flex-none place-items-end justify-center font-mono font-bold !tracking-[0.04em] text-white", TILE[size], fileTone(suffix))}>
      <i className="absolute end-0 top-0 size-[28%] rounded-bl-[30%] bg-white/30 rtl:-scale-x-100" />
      {fileLabel(suffix)}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block size-4 animate-spin rounded-full border-2 border-line2 border-t-acid" />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-1 px-6 py-14 text-center">
      <b className="text-[15px] font-semibold">{title}</b>
      {children && <p className="text-ink3">{children}</p>}
    </div>
  );
}
