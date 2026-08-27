import { Logo } from "@/components/shared/logo";
import { KeyboardInset } from "@/components/shared/keyboard-inset";
import { AuthBackPill } from "@/features/auth/components/auth-back-pill";
import { SITE } from "@/lib/constants";
import { GRAIN } from "@/lib/textures";

/* Glass orbs — radial highlight gives a soft 3D ball feel; colors follow the
   active theme via --orb-a/--orb-b/--orb-c (globals.css). */
const ORB_A = `radial-gradient(circle at 32% 28%, var(--orb-b) 0%, var(--orb-a) 38%, transparent 72%)`;
const ORB_B = `radial-gradient(circle at 30% 25%, var(--orb-b) 0%, var(--orb-c) 42%, transparent 74%)`;

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

      {/* ── Backdrop: drifting glass orbs + fade to the page background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-24 top-24 size-72 rounded-full blur-[2px] sm:-left-36 sm:size-104"
          style={{
            backgroundImage: ORB_A,
            animation: "drift 9s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-20 -bottom-28 size-80 rounded-full blur-[3px] sm:-right-24 sm:-bottom-40 sm:size-128"
          style={{
            backgroundImage: ORB_B,
            animation: "drift 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute right-16 top-16 hidden size-32 rounded-full blur-[1px] sm:block"
          style={{
            backgroundImage: ORB_A,
            animation: "drift 7s ease-in-out infinite",
          }}
        />
        <div className="from-background absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t to-transparent" />
        {/* fine grain over everything */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />
      </div>

      {/* ── Back pill (contextual: shop, or login on forgot-password) ── */}
      <AuthBackPill />

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
            className="via-foreground/25 absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent to-transparent"
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
