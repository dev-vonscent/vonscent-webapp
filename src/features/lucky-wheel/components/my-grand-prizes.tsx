"use client";

import * as React from "react";
import Link from "next/link";
import { Gift, Package, PackageCheck, Truck, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysLeft } from "../prize-state";
import { useGrandPrizes } from "../use-wheel";
import type { GrandPrize, GrandPrizeState } from "../types";
import { GrandBundleChooser } from "./grand-bundle-chooser";

const STATE_LABEL: Record<GrandPrizeState, string> = {
  choose: "Багцаа сонгоно уу",
  ready: "Дараагийн захиалгад орно",
  in_order: "Захиалгад орсон",
  delivered: "Хүргэгдсэн",
  expired: "Хугацаа дууссан",
};

const STATE_ICON = {
  choose: Gift,
  ready: Gift,
  in_order: Truck,
  delivered: PackageCheck,
  expired: XCircle,
} as const;

function PrizeRow({
  prize,
  options,
}: {
  prize: GrandPrize;
  options: Parameters<typeof GrandBundleChooser>[0]["options"];
}) {
  const [changing, setChanging] = React.useState(false);
  const open = prize.state === "choose" || prize.state === "ready";
  const left = daysLeft(prize.expiresAt);
  const Icon =
    prize.kind === "product" && open ? Package : STATE_ICON[prize.state];

  return (
    <li
      className={cn(
        "space-y-3 rounded-2xl p-4",
        open ? "bg-foreground/6" : "bg-foreground/3",
      )}
      style={
        open
          ? { boxShadow: "inset 0 0 0 1px var(--wheel-gold-deep)" }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            open ? "bg-wheel-gold text-wheel-ink-dark" : "bg-foreground/8",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {prize.kind === "product"
              ? (prize.productName ?? prize.label)
              : (prize.bundleName ?? prize.label)}
            {(prize.kind === "product" ? prize.ml : prize.gender && 2) && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {prize.kind === "product" ? prize.ml : 2}мл
              </span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            {STATE_LABEL[prize.state]}
            {prize.state === "in_order" && prize.orderNo && (
              <> · {prize.orderNo}</>
            )}
            {open && left !== null && (
              <> · {left > 0 ? `${left} хоног үлдсэн` : "өнөөдөр дуусна"}</>
            )}
            {!open && <> · {formatDate(prize.wonAt)}</>}
          </p>
        </div>
        {prize.state === "ready" && prize.kind === "bundle" && !changing && (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline underline-offset-4"
          >
            Солих
          </button>
        )}
      </div>

      {(prize.state === "choose" || changing) && (
        <GrandBundleChooser
          spinId={prize.spinId}
          options={options}
          selected={prize.gender}
          onChosen={() => setChanging(false)}
        />
      )}

      {prize.state === "ready" && !changing && (
        <p className="text-xs">
          Дараагийн захиалгын төлбөр хийх хуудсанд үнэгүй нэмэгдэнэ.{" "}
          <Link href="/catalog" className="underline underline-offset-4">
            Дэлгүүр үзэх
          </Link>
        </p>
      )}
    </li>
  );
}

/**
 * «Миний шагнал» — the physical prizes this customer has won (grand bundles,
 * products) and where each one is. Renders nothing for a customer who has
 * never won one.
 */
export function MyGrandPrizes({
  signedIn,
  className,
}: {
  signedIn: boolean;
  className?: string;
}) {
  const { data } = useGrandPrizes(signedIn);
  if (!data || data.prizes.length === 0) return null;
  return (
    <section id="prizes" className={cn("scroll-mt-28", className)}>
      <h2 className="text-wheel-accent mb-3 text-xs font-bold tracking-[0.3em] uppercase">
        Миний шагнал
      </h2>
      <ul className="space-y-2">
        {data.prizes.map((p) => (
          <PrizeRow key={p.spinId} prize={p} options={data.options} />
        ))}
      </ul>
    </section>
  );
}
