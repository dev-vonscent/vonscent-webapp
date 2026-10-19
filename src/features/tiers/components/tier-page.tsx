"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { USER_TIERS, type UserTierKey } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tierProgress } from "../lib";
import type { TierSummary } from "../types";
import { useMyTier } from "../use-tier";
import { TierBadge, TierFrame } from "./tier-frame";
import { TopCustomers } from "./top-customers";

/** «1 сая₮», «2.5 сая₮» — шатны хязгаарт бүтэн тооноос уншигдахуйц. */
function formatMillion(amount: number): string {
  if (amount === 0) return "0₮";
  return `${amount / 1_000_000} сая₮`;
}

function initialOf(name: string | null | undefined) {
  return (name?.trim() || "V").charAt(0).toUpperCase();
}

export function TierPage() {
  const { data, isPending, isError } = useMyTier();

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <Link
          href="/account"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" /> Профайл
        </Link>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">
          Хэрэглэгчийн түвшин
        </h1>
      </header>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState
          title="Түвшний мэдээлэл ачаалагдсангүй"
          description="Хуудсаа сэргээгээд дахин оролдоно уу."
        />
      ) : (
        <>
          <Hero summary={data} />
          <Ladder current={data.tier} />
          <TopCustomers
            boards={data.leaderboards}
            myAvatar={data.me.avatarUrl}
            showMe
          />
        </>
      )}
    </div>
  );
}

/* ── Hero: хүрээтэй зураг + явц ─────────────────────────────── */

function Hero({ summary }: { summary: TierSummary }) {
  const { tier, next, remaining, ratio } = tierProgress(summary.lifetimeSpend);
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card space-y-6 rounded-3xl p-6 sm:p-8"
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left">
        <TierFrame
          tier={tier.key}
          className="[--avatar:88px] sm:[--avatar:104px]"
        >
          {summary.me.avatarUrl ? (
            <Image
              src={summary.me.avatarUrl}
              alt=""
              fill
              sizes="104px"
              className="object-cover"
            />
          ) : (
            <span className="text-muted-foreground flex h-full items-center justify-center font-serif text-4xl">
              {initialOf(summary.me.name)}
            </span>
          )}
        </TierFrame>
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Таны түвшин
          </p>
          <p className="font-serif text-3xl font-semibold sm:text-4xl">
            {tier.label}
          </p>
          <p className="text-gold-strong text-sm font-medium">
            Захиалга бүрээс {tier.rate}% V point
          </p>
          <p className="text-muted-foreground text-sm">
            Нийт худалдан авалт{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatPrice(summary.lifetimeSpend)}
            </span>
          </p>
        </div>
      </div>

      {/* Дараагийн түвшин хүртэлх явц — хэвтээ bar. */}
      <div className="space-y-2">
        {next ? (
          <>
            <div className="flex items-center justify-between gap-3 text-xs">
              <TierBadge tier={tier.key} />
              <TierBadge tier={next.key} />
            </div>
            <div
              role="progressbar"
              aria-label={`${next.label} түвшин хүртэлх явц`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
              className="bg-secondary h-2.5 overflow-hidden rounded-full"
            >
              <motion.div
                className="bg-foreground h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(ratio * 100, 2)}%` }}
                transition={{
                  duration: 1.2,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.2,
                }}
              />
            </div>
            <p className="text-muted-foreground text-sm">
              {next.label} хүртэл{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {formatPrice(remaining)}
              </span>{" "}
              дутуу · {next.rate}% V point
            </p>
          </>
        ) : (
          <p className="text-sm font-medium">Та хамгийн дээд түвшинд хүрсэн</p>
        )}
      </div>
    </motion.section>
  );
}

/* ── Түвшний шат ───────────────────────────────────────────────────── */

function Ladder({ current }: { current: UserTierKey }) {
  const currentIndex = USER_TIERS.findIndex((t) => t.key === current);
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">Түвшний шат</h2>
      <ol className="grid gap-3 sm:grid-cols-5">
        {USER_TIERS.map((t, i) => {
          const reached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const upper = USER_TIERS[i + 1]?.minSpend;
          return (
            <motion.li
              key={t.key}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                "bg-card relative flex items-center gap-4 rounded-2xl p-4 sm:flex-col sm:gap-3 sm:text-center",
                isCurrent && "ring-foreground ring-2",
              )}
            >
              {/* Чимэглэлийн хэмжээ түвшнээс хамаарна — тогтмол талбайд
                  төвлөрүүлж, картууд жигд харагдана. */}
              <span className="flex h-[calc(var(--avatar)*1.8)] w-[calc(var(--avatar)*1.5)] shrink-0 items-center justify-center [--avatar:40px] sm:[--avatar:44px]">
                <TierFrame tier={t.key}>
                  <span className="flex h-full items-center justify-center font-serif text-sm font-semibold">
                    {t.rate}%
                  </span>
                </TierFrame>
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold">{t.label}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {upper
                    ? `${formatMillion(t.minSpend)} – ${formatMillion(upper)}`
                    : `${formatMillion(t.minSpend)}-аас дээш`}
                </p>
              </div>
              <span className="sm:absolute sm:top-2 sm:right-2">
                {isCurrent ? (
                  <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    Та энд
                  </span>
                ) : reached ? (
                  <Check className="text-muted-foreground size-4" />
                ) : (
                  <Lock className="text-muted-foreground size-4" />
                )}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
