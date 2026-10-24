"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from "../lib";
import type { Leaderboard, LeaderboardEntry, Leaderboards } from "../types";
import { TierFrame } from "./tier-frame";

function initialOf(name: string | null | undefined) {
  return (name?.trim() || "V").charAt(0).toUpperCase();
}

/**
 * «Top 3 хэрэглэгч» — сүүлийн 7 хоног / 1 сар / бүх цаг үеийн хамгийн их
 * худалдан авалт хийсэн гурав, тухайн хугацааны захиалгын дүнтэй
 * (feature flag `user_tiers`). Нүүр хуудас
 * (хэн ч, `me` байхгүй) ба түвшний хуудсанд (өөрийн байр, зурагтай) ижил.
 */
export function TopCustomers({
  boards,
  myAvatar = null,
  showMe = false,
  headingClassName,
}: {
  boards: Leaderboards;
  /** Нэвтэрсэн хэрэглэгч топод байвал өөрийн зургаар. */
  myAvatar?: string | null;
  /** Топод ороогүй бол «Таны байр #N» мөр. */
  showMe?: boolean;
  headingClassName?: string;
}) {
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("week");
  const board = boards[period];

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div>
          <h2
            className={cn(
              "font-serif text-xl font-semibold tracking-tight",
              headingClassName,
            )}
          >
            Top 3 хэрэглэгч
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Хамгийн их худалдан авалт хийсэн хэрэглэгчид
          </p>
        </div>
        <SegmentedTabs
          label="Хугацаа"
          tabs={LEADERBOARD_PERIODS.map((p) => ({
            value: p.key,
            label: p.label,
          }))}
          value={period}
          onChange={setPeriod}
          className="sm:inline-flex"
        />
      </div>

      <Podium key={period} board={board} myAvatar={myAvatar} />

      {showMe && (
        <p className="text-muted-foreground bg-secondary rounded-xl px-4 py-3 text-center text-sm">
          {board.me ? (
            <>
              Таны байр{" "}
              <span className="text-foreground font-semibold">
                #{board.me.rank}
              </span>{" "}
              — шилдэг гуравт ойртож байна!
            </>
          ) : board.top.some((e) => e.isMe) ? (
            "Та шилдэг гуравт байна — байраа хадгалаарай!"
          ) : (
            "Энэ хугацаанд захиалга хийгээд жагсаалтад нэрээ гаргаарай."
          )}
        </p>
      )}
    </section>
  );
}

/** Тавцангийн дараалал: 2 · 1 · 3 — ялагч голд, хамгийн өндөрт. */
const PODIUM_ORDER = [2, 1, 3] as const;
const PODIUM_HEIGHT: Record<number, string> = {
  1: "h-24",
  2: "h-16",
  3: "h-12",
};

function Podium({
  board,
  myAvatar,
}: {
  board: Leaderboard;
  myAvatar: string | null;
}) {
  const meInTop = board.top.some((e) => e.isMe);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-3 items-end gap-2 sm:gap-4"
    >
      {PODIUM_ORDER.map((rank, i) => {
        const entry = board.top.find((e) => e.rank === rank);
        return (
          <div key={rank} className="flex min-w-0 flex-col items-center gap-2">
            {entry ? (
              <PodiumPerson entry={entry} myAvatar={myAvatar} />
            ) : (
              <div className="flex flex-col items-center gap-2 pb-1">
                <span className="border-border flex size-14 items-center justify-center rounded-full border border-dashed">
                  <span className="text-muted-foreground text-xs">Сул</span>
                </span>
                {/* Үзэгч өөрөө топод байвал «таных байж болно» утгагүй. */}
                {!meInTop && (
                  <p className="text-muted-foreground text-center text-xs">
                    Энэ байр таных байж болно
                  </p>
                )}
              </div>
            )}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.1 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "flex w-full origin-bottom items-start justify-center rounded-t-xl pt-2 font-serif text-2xl font-semibold",
                PODIUM_HEIGHT[rank],
                rank === 1 ? "bg-foreground text-background" : "bg-secondary",
              )}
            >
              {rank}
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}

function PodiumPerson({
  entry,
  myAvatar,
}: {
  entry: LeaderboardEntry;
  myAvatar: string | null;
}) {
  const winner = entry.rank === 1;
  const avatar = entry.avatarUrl ?? (entry.isMe ? myAvatar : null);
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-1.5">
      <TierFrame
        tier={entry.tier}
        className={
          winner
            ? "[--avatar:56px] sm:[--avatar:72px]"
            : "[--avatar:44px] sm:[--avatar:56px]"
        }
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <span
            className={cn(
              "flex h-full items-center justify-center font-serif font-semibold",
              winner ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
            )}
          >
            {initialOf(entry.name)}
          </span>
        )}
      </TierFrame>
      <p className="w-full truncate text-center text-sm font-medium">
        {entry.name}
        {entry.isMe && <span className="text-muted-foreground"> (Та)</span>}
      </p>
      <p className="text-muted-foreground text-xs font-medium tabular-nums sm:text-sm">
        {formatPrice(entry.amount)}
      </p>
    </div>
  );
}
