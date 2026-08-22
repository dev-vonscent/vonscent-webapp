import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { KeyboardInset } from "@/components/shared/keyboard-inset";
import { SITE } from "@/lib/constants";

/* Grain texture as an inline SVG — keeps the glass card from feeling flat. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/* Static ambient glow — pre-blurred radial gradients, no CSS filters. */
const AMBIENT = `
  radial-gradient(60% 45% at 50% 0%, color-mix(in oklab, var(--foreground) 9%, transparent), transparent 70%),
  radial-gradient(45% 40% at 88% 92%, color-mix(in oklab, var(--gold) 10%, transparent), transparent 70%),
  radial-gradient(38% 34% at 8% 78%, color-mix(in oklab, var(--foreground) 5%, transparent), transparent 70%)
`;

/* Faint light beams that rotate slowly behind everything. */
const SHEEN = `conic-gradient(
  from 0deg,
  transparent 0deg,
  color-mix(in oklab, var(--foreground) 4%, transparent) 55deg,
  transparent 110deg,
  transparent 180deg,
  color-mix(in oklab, var(--gold) 3%, transparent) 240deg,
  transparent 300deg
)`;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 pt-14 transition-[padding-bottom] duration-300 ease-out"
      style={{ paddingBottom: "calc(3.5rem + var(--kb-inset, 0px))" }}
    >
      {/* iOS: lift the form above the on-screen keyboard */}
      <KeyboardInset />

      {/* ── Ambient backdrop: static glow + slowly rotating light beams ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: AMBIENT }}
        />
        {/* transform-only rotation — stays smooth, unlike animated blurs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className="animate-sheen size-[170vmax] rounded-full"
            style={{ backgroundImage: SHEEN }}
          />
        </div>
        {/* fine grain over everything */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
      </div>

      {/* ── Giant watermark wordmark (desktop only) ── */}
      <span
        aria-hidden
        className="text-foreground/[0.04] pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-[19vw] leading-none font-semibold tracking-tighter whitespace-nowrap select-none sm:block"
      >
        vonscent
      </span>

      {/* ── Back to shop ── */}
      <Link
        href="/"
        className="glass text-muted-foreground hover:text-foreground shadow-soft absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all hover:-translate-x-0.5 sm:top-6 sm:left-6"
      >
        <ArrowLeft className="size-4" /> Дэлгүүр рүү буцах
      </Link>

      {/* ── Brand mark + tagline ── */}
      <div className="animate-fade-up relative z-10 mb-8 flex flex-col items-center gap-3">
        <Logo className="text-3xl" />
        <div className="text-muted-foreground flex items-center gap-3 text-[11px] tracking-[0.35em] uppercase">
          <span className="gold-rule w-8" />
          {SITE.tagline}
          <span className="gold-rule w-8" />
        </div>
      </div>

      {/* ── Glass form card ── */}
      <div className="relative z-10 w-full max-w-sm">
        {/* soft halo behind the card */}
        <div
          aria-hidden
          className="bg-foreground/5 absolute -inset-6 -z-10 rounded-[2.5rem] blur-2xl"
        />
        <div className="glass shadow-lift ring-foreground/10 relative rounded-3xl p-6 ring-1 sm:p-8">
          {/* hairline shine along the top edge */}
          <div
            aria-hidden
            className="via-foreground/25 absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent"
          />
          {children}
        </div>
      </div>

      {/* ── Footnote ── */}
      <p className="text-muted-foreground/70 animate-fade-up relative z-10 mt-8 text-center text-[11px] tracking-[0.3em] uppercase [animation-delay:300ms]">
        {SITE.name} · Est. Ulaanbaatar
      </p>
    </div>
  );
}
