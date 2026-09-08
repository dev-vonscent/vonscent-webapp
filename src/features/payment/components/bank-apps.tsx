"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  findBank,
  groupBankLinks,
  mockBankGroups,
  type BankLink,
} from "@/lib/payments/qpay-banks";
import { useCanOpenApps } from "../use-can-open-apps";
import type { QpayDeeplink } from "../types";

/**
 * The bank/wallet picker — the primary way anyone pays on a phone.
 *
 * Modelled on QPay's own "Төлбөрийн хэрэгсэл" screen, which is what customers
 * already know: apps grouped into Банк and Цахим хэтэвч, a four-across grid of
 * full-bleed app icons, and the app they used last pulled to the top.
 *
 * The grid leads the page rather than the QR because on a phone the banking
 * app is on *this* device — a QR on this screen cannot be scanned. The QR is
 * the desktop path and the fallback.
 *
 * A plain `<a href="khanbank://…">` is what actually hands off to the app:
 * `router.push` would try to route a custom scheme, and `window.open` is
 * swallowed by pop-up blockers on iOS Safari.
 */

/** Which app the customer reached for last, so it can lead next time. */
const LAST_BANK_KEY = "vonscent-last-bank";

function readLastBank(): string | null {
  try {
    return localStorage.getItem(LAST_BANK_KEY);
  } catch {
    // Private window or blocked site data — the section simply doesn't show.
    return null;
  }
}

export function BankApps({
  links,
  mock,
}: {
  links: QpayDeeplink[];
  /** Mock invoices carry no deeplinks — show the real roster, linkless. */
  mock?: boolean;
}) {
  const groups = React.useMemo(
    () => (mock ? mockBankGroups() : groupBankLinks(links)),
    [links, mock],
  );
  // On a desktop these icons are a legend for the QR, not buttons — see
  // `useCanOpenApps`.
  const interactive = useCanOpenApps();
  const [lastScheme, setLastScheme] = React.useState<string | null>(null);
  /** Set after a tap that did not appear to leave the page — see `onHandoff`. */
  const [stuck, setStuck] = React.useState<string | null>(null);

  // Read on mount, never during render: the server has no localStorage, so
  // reading it inline would hydrate a different tree than it rendered.
  React.useEffect(() => setLastScheme(readLastBank()), []);

  if (groups.length === 0) return null;
  // "Recently used" is a shortcut for tapping; with nothing to tap it is noise.
  const recent =
    interactive && lastScheme ? findBank(groups, lastScheme) : null;

  /**
   * A custom-scheme link fails silently when the app is not installed: no
   * error, no navigation, nothing. So the tap is timed — if the document is
   * still visible a moment later the hand-off did not happen, and the customer
   * gets told why instead of tapping a dead icon again.
   */
  function onHandoff(bank: BankLink) {
    if (!bank.link) return;
    try {
      localStorage.setItem(LAST_BANK_KEY, bank.scheme);
    } catch {
      // storage blocked — the hand-off itself still works
    }
    setStuck(null);
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStuck(bank.name);
    }, 1500);
    // Leaving for the app hides the document, which is the success signal.
    document.addEventListener(
      "visibilitychange",
      () => window.clearTimeout(t),
      {
        once: true,
      },
    );
  }

  return (
    <div className="space-y-6">
      {recent && (
        <section className="space-y-2">
          <SectionLabel>Сүүлд хэрэглэсэн</SectionLabel>
          <RecentRow bank={recent} onHandoff={onHandoff} />
        </section>
      )}

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <SectionLabel>{group.label}</SectionLabel>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
            {group.banks.map((bank) => (
              <li key={bank.scheme}>
                <BankTile
                  bank={bank}
                  onHandoff={onHandoff}
                  interactive={interactive}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {stuck && <HandoffHint bank={stuck} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-xs font-medium">{children}</h3>
  );
}

/**
 * The app icon.
 *
 * `object-contain` on a neutral tile rather than `object-cover`: QPay serves
 * square app icons for most apps, where the two are identical, but a couple
 * are wide wordmarks that cover would crop into nonsense. The hairline ring
 * keeps a white icon from bleeding into the white and pink themes.
 */
function BankIcon({ bank, size }: { bank: BankLink; size: "sm" | "lg" }) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = Boolean(bank.logo) && !failed;

  return (
    <span
      className={cn(
        "bg-secondary ring-border relative flex shrink-0 items-center justify-center overflow-hidden ring-1",
        size === "lg" ? "size-14 rounded-2xl sm:size-16" : "size-10 rounded-xl",
      )}
    >
      {showLogo ? (
        <Image
          src={bank.logo!}
          alt=""
          fill
          sizes={size === "lg" ? "64px" : "40px"}
          // QPay's CDN serves small, already-optimised PNGs; a transformation
          // per app per order would cost more than it saves.
          unoptimized
          className="object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        // A dead logo URL must not leave an anonymous grey square — the
        // wordmark is what makes the icon identifiable.
        <span
          className={cn(
            "text-muted-foreground font-bold tracking-tight",
            size === "lg" ? "text-[11px]" : "text-[9px]",
          )}
        >
          {bank.short}
        </span>
      )}
    </span>
  );
}

function BankTile({
  bank,
  onHandoff,
  interactive,
}: {
  bank: BankLink;
  onHandoff: (bank: BankLink) => void;
  /** False on a desktop, where a custom-scheme link cannot resolve. */
  interactive: boolean;
}) {
  const label = (
    <span className="line-clamp-2 text-[11px] leading-tight font-medium">
      {bank.name}
    </span>
  );
  const shell = "flex flex-col items-center gap-2 text-center";

  // Mock mode ships linkless tiles so the layout can be reviewed without
  // credentials; they must not look tappable.
  if (!bank.link) {
    return (
      <div className={cn(shell, "opacity-50")} aria-disabled>
        <BankIcon bank={bank} size="lg" />
        {label}
      </div>
    );
  }

  // Desktop: the same tiles, as a legend for the QR above them.
  if (!interactive) {
    return (
      <div className={shell}>
        <BankIcon bank={bank} size="lg" />
        {label}
      </div>
    );
  }

  return (
    <a
      href={bank.link}
      onClick={() => onHandoff(bank)}
      className={cn(
        shell,
        "group transition-transform duration-150 active:scale-95",
      )}
      aria-label={`${bank.name} аппаар төлөх`}
    >
      <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
        <BankIcon bank={bank} size="lg" />
      </span>
      {label}
    </a>
  );
}

/** The last-used app as a full-width row — one tap, no hunting in the grid. */
function RecentRow({
  bank,
  onHandoff,
}: {
  bank: BankLink;
  onHandoff: (bank: BankLink) => void;
}) {
  if (!bank.link) {
    return (
      <div className="border-border flex items-center gap-3 rounded-xl border p-2.5 opacity-50">
        <BankIcon bank={bank} size="sm" />
        <span className="text-sm font-medium">{bank.name}</span>
      </div>
    );
  }
  return (
    <a
      href={bank.link}
      onClick={() => onHandoff(bank)}
      className="border-border hover:border-gold-strong/40 hover:bg-accent flex items-center gap-3 rounded-xl border p-2.5 transition-colors"
      aria-label={`${bank.name} аппаар төлөх`}
    >
      <BankIcon bank={bank} size="sm" />
      <span className="text-sm font-medium">{bank.name}</span>
      <ChevronRight className="text-muted-foreground ml-auto size-4" />
    </a>
  );
}

function HandoffHint({ bank }: { bank: string }) {
  return (
    <p
      role="status"
      className="bg-secondary text-muted-foreground rounded-md px-3 py-2 text-xs"
    >
      <strong className="text-foreground">{bank}</strong> апп нээгдсэнгүй.
      Тухайн апп суулгаагүй байж магадгүй — өөр апп сонгох, эсвэл доорх QR кодыг
      өөр төхөөрөмжөөс уншуулж төлөөрэй.
    </p>
  );
}
