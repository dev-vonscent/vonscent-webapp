"use client";

import * as React from "react";
import { Gift } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { daysLeft } from "../prize-state";
import { useGrandPrizes } from "../use-wheel";
import { GrandBundleChooser } from "./grand-bundle-chooser";

/**
 * The grand prize at checkout (0165): a won 2ml bundle rides along with this
 * order for 0₮. A picked prize is attached by default — the customer opted
 * into it when they chose the bundle — and can be held back for a later
 * order; an unpicked one is picked right here.
 *
 * `value` is the spin id that goes to the order (`prizeSpinId`), or null.
 * Stock is reserved with the order itself (`place_order_with_prize`).
 */
export function CheckoutPrize({
  enabled,
  value,
  onChange,
}: {
  /** Signed in and the wheel flag is on. */
  enabled: boolean;
  value: string | null;
  onChange: (spinId: string | null) => void;
}) {
  const { data } = useGrandPrizes(enabled);
  // Oldest-expiring first: the one closest to lapsing goes out first.
  const open = (data?.prizes ?? [])
    .filter((p) => p.state === "choose" || p.state === "ready")
    .sort(
      (a, b) =>
        new Date(a.expiresAt ?? 0).getTime() -
        new Date(b.expiresAt ?? 0).getTime(),
    );
  const ready = open.find((p) => p.state === "ready");
  const choose = open.find((p) => p.state === "choose");

  // Attach the ready prize once, when it first shows up — not again after
  // the customer has unticked it.
  const offered = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (ready && offered.current !== ready.spinId) {
      offered.current = ready.spinId;
      onChange(ready.spinId);
    }
    if (!ready && value) onChange(null);
  }, [ready, value, onChange]);

  if (!enabled || (!ready && !choose)) return null;

  const left = daysLeft((ready ?? choose)!.expiresAt);
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
            Азын хүрдний гранд шагнал
          </h2>
          <p className="text-muted-foreground text-sm">
            {ready
              ? `«${ready.bundleName}» 2мл багц энэ захиалгад үнэгүй орно.`
              : "Багцаа сонгоод энэ захиалгадаа үнэгүй аваарай."}
            {left !== null && ` ${left} хоног үлдсэн.`}
          </p>
        </div>
      </div>

      {ready ? (
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={value === ready.spinId}
            onCheckedChange={(on) => onChange(on ? ready.spinId : null)}
          />
          Энэ захиалгад авах
        </label>
      ) : (
        choose &&
        data && (
          <GrandBundleChooser spinId={choose.spinId} options={data.options} />
        )
      )}
    </section>
  );
}
