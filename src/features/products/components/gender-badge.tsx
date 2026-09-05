import type * as React from "react";
import type { SVGProps } from "react";
import { GENDER_LABEL, type Gender } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Хүйсийн визуал тэмдэг (backlog C1): ♂ / ♀ / ⚥ тэмдэг + нэр.
 *
 * lucide-react 0.468-д Mars / Venus дүрс байхгүй тул мөрүүд нь lucide-ийн
 * дараагийн хувилбарын path-уудыг шууд авчирсан — ижил 24×24 grid, ижил
 * stroke, тиймээс бусад дүрсний хажууд ялгарахгүй.
 */
const ICON: Record<Gender, React.ReactNode> = {
  male: (
    <>
      <path d="M16 3h5v5" />
      <path d="m21 3-6.75 6.75" />
      <circle cx="10" cy="14" r="6" />
    </>
  ),
  female: (
    <>
      <path d="M12 15v7" />
      <path d="M9 19h6" />
      <circle cx="12" cy="9" r="6" />
    </>
  ),
  unisex: (
    <>
      <path d="M10 20h4" />
      <path d="M12 16v6" />
      <path d="M17 2h4v4" />
      <path d="m21 2-5.46 5.46" />
      <circle cx="12" cy="11" r="5" />
    </>
  ),
};

export function GenderIcon({
  gender,
  className,
  ...props
}: { gender: Gender } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-3.5 shrink-0", className)}
      {...props}
    >
      {ICON[gender]}
    </svg>
  );
}

/**
 * Хүйсийн шошго. Картан дээр `tone="muted"` — брэндийн мөрийн хажууд чимээгүй
 * тэмдэг; дэлгэрэнгүй дээр `tone="pill"` — таг badge-уудын хажууд нэг мөр.
 * Өнгөөр ялгахгүй (design.md: theme token, хүйсээр өнгө тавьдаг хэвшил
 * дизайнд байхгүй) — дүрс нь өөрөө ялгаа болно.
 */
export function GenderBadge({
  gender,
  tone = "pill",
  className,
}: {
  gender: Gender;
  tone?: "pill" | "muted";
  className?: string;
}) {
  const label = GENDER_LABEL[gender];
  if (tone === "muted") {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1 text-[11px]",
          className,
        )}
        title={label}
      >
        <GenderIcon gender={gender} className="size-3" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "border-border bg-secondary/60 text-foreground/80 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <GenderIcon gender={gender} />
      {label}
    </span>
  );
}
