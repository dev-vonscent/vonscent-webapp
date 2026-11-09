"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, UserRound } from "lucide-react";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { cn } from "@/lib/utils";
import { profileCompletion } from "../lib";
import { useProfileInfo } from "../use-profile-info";

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Профайл хуудсаас «Миний мэдээлэл» рүү орох карт (feature flag
 * `profile_info`-г дуудагч шалгана).
 *
 * Энгийн цэсний мөр биш: icon-ыг тойрсон цагираг нь хэдэн хувь бөглөснийг,
 * доод мөр нь юу хийхийг, баруун талын зоос нь хэдэн V point авахыг
 * харуулна. Бүрэн бөглөсөн (эсвэл ачаалж буй) үед профайлын бусад мөртэй
 * адил энгийн мөр болно.
 */
export function ProfileInfoEntryCard({ className }: { className?: string }) {
  const { data: info } = useProfileInfo();
  const completion = info ? profileCompletion(info) : null;
  const reward =
    info && info.reward.points > 0 && info.reward.claimedPoints === null
      ? info.reward.points
      : 0;

  // Ачаалж байх үед ч энгийн мөр — бүрэн бөглөсөн хүнд анивчихгүй.
  // Бүрэн боловч урамшуулал аваагүй (олголт тасарсан, админ дараа нь
  // асаасан) бол энгийн болохгүй — хуудас руу орж байж олгогдоно.
  if (!completion || (completion.complete && reward === 0)) {
    return (
      <Link
        href="/account/info"
        className={cn(
          "bg-card hover:bg-accent flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors",
          className,
        )}
      >
        <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
          <UserRound className="size-4" />
        </span>
        <span className="font-medium">Миний мэдээлэл</span>
        <ChevronRight className="text-muted-foreground ml-auto size-4" />
      </Link>
    );
  }

  const left = completion.total - completion.done;
  // Бөглөөд урамшуулал хүлээж буй үе — статус ба зоосоор тодруулна.
  const inviting = reward > 0;
  const status = completion.complete
    ? "Урамшууллаа аваарай"
    : inviting
      ? `${left} мэдээлэл үлдлээ — бөглөөд V point аваарай`
      : `${left} мэдээлэл дутуу`;

  return (
    <Link
      href="/account/info"
      className={cn(
        "bg-card hover:bg-accent flex items-center gap-4 rounded-xl p-4 transition-colors",
        className,
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 40 40"
          aria-hidden
          className="absolute inset-0 size-10 -rotate-90"
        >
          <circle
            cx="20"
            cy="20"
            r={RING_R}
            fill="none"
            strokeWidth="2.5"
            className="stroke-secondary"
          />
          <motion.circle
            cx="20"
            cy="20"
            r={RING_R}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            initial={{ strokeDashoffset: RING_C }}
            animate={{ strokeDashoffset: RING_C * (1 - completion.ratio) }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="stroke-gold-strong"
          />
        </svg>
        <UserRound className="size-4" />
      </span>

      <span className="min-w-0">
        <span className="block font-medium">Миний мэдээлэл</span>
        <span
          className={cn(
            "block truncate text-xs tabular-nums",
            inviting ? "text-gold-strong" : "text-muted-foreground",
          )}
        >
          {status}
        </span>
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {inviting ? (
          <span className="bg-secondary text-gold-strong flex items-center gap-1 rounded-full py-1 pr-2.5 pl-1 text-sm font-semibold tabular-nums">
            <VPointIcon className="size-5" />+{reward.toLocaleString("mn-MN")}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm tabular-nums">
            {completion.done}/{completion.total}
          </span>
        )}
        <ChevronRight className="text-muted-foreground size-4" />
      </span>
    </Link>
  );
}
