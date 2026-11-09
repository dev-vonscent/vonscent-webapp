"use client";

import * as React from "react";
import { Gift, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { daysLeft } from "../prize-state";
import { useGrandPrizes } from "../use-wheel";
import type { GrandPrize } from "../types";
import { GrandBundleChooser } from "./grand-bundle-chooser";

/** What the prize is, as the order will list it. */
function prizeName(p: GrandPrize): string {
  if (p.kind === "product") {
    return `${p.productName ?? p.label}${p.ml ? ` ${p.ml}мл` : ""}`;
  }
  return `«${p.bundleName ?? p.label}» 2мл багц`;
}

/**
 * Physical prizes at checkout: a won grand bundle (0165) or perfume (0170)
 * rides along with this order for 0₮. A ready prize is attached by default —
 * the customer won it to get it — and can be held back for a later order; an
 * unpicked grand bundle is picked right here.
 *
 * `value` is the spin ids that go to the order (`prizeSpinIds`). Stock is
 * reserved with the order itself (`place_order_with_prizes`).
 */
export function CheckoutPrize({
  enabled,
  value,
  onChange,
}: {
  /** Signed in and the wheel flag is on. */
  enabled: boolean;
  value: string[];
  onChange: (spinIds: string[]) => void;
}) {
  const { data } = useGrandPrizes(enabled);
  // Oldest-expiring first: the one closest to lapsing is listed first.
  const open = (data?.prizes ?? [])
    .filter((p) => p.state === "choose" || p.state === "ready")
    .sort(
      (a, b) =>
        new Date(a.expiresAt ?? 0).getTime() -
        new Date(b.expiresAt ?? 0).getTime(),
    );
  const ready = open.filter((p) => p.state === "ready");
  const choose = open.find((p) => p.state === "choose");
  const readyKey = ready.map((p) => p.spinId).join(",");

  // Attach each ready prize once, when it first shows up — not again after
  // the customer has unticked it — and drop ids that are no longer ready.
  const offered = React.useRef(new Set<string>());
  React.useEffect(() => {
    const ids = readyKey ? readyKey.split(",") : [];
    const fresh = ids.filter((id) => !offered.current.has(id));
    fresh.forEach((id) => offered.current.add(id));
    const next = [...value.filter((id) => ids.includes(id)), ...fresh];
    if (next.length !== value.length || fresh.length > 0) onChange(next);
  }, [readyKey, value, onChange]);

  if (!enabled || (ready.length === 0 && !choose)) return null;

  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...value, id] : value.filter((v) => v !== id));

  return (
    <section
      className="bg-card space-y-4 rounded-2xl p-5"
      style={{ boxShadow: "inset 0 0 0 1px var(--wheel-gold-deep)" }}
      aria-labelledby="checkout-prize-title"
    >
      <div className="flex items-start gap-3">
        <span className="bg-wheel-gold text-wheel-ink-dark grid size-10 shrink-0 place-items-center rounded-full">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="checkout-prize-title" className="font-semibold">
            Азын хүрдний шагнал
          </h2>
          <p className="text-muted-foreground text-sm">
            {ready.length > 0
              ? "Сонгосон шагнал энэ захиалгад үнэгүй орно."
              : "Багцаа сонгоод энэ захиалгадаа үнэгүй аваарай."}
          </p>
        </div>
      </div>

      {ready.length > 0 && (
        <ul className="space-y-3">
          {ready.map((p) => {
            const left = daysLeft(p.expiresAt);
            const Icon = p.kind === "product" ? Package : Gift;
            return (
              <li key={p.spinId}>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={value.includes(p.spinId)}
                    onCheckedChange={(on) => toggle(p.spinId, on === true)}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="text-muted-foreground size-3.5 shrink-0" />
                      {prizeName(p)}
                    </span>
                    {left !== null && (
                      <span className="text-muted-foreground block text-xs">
                        {left > 0 ? `${left} хоног үлдсэн` : "Өнөөдөр дуусна"}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {choose && data && (
        <GrandBundleChooser spinId={choose.spinId} options={data.options} />
      )}
    </section>
  );
}
