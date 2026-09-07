"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Copy, Crown, Gift, Sparkles, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatDate, formatPrice } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { SpinSuccess } from "../types";

/** Headline per tier — the wheel's only moment of raised voice. */
const TIER_TITLE = {
  common: "Баяр хүргэе!",
  rare: "Ховор шагнал!",
  grand: "ГРАНД ШАГНАЛ!",
} as const;

function PrizeIcon({ kind }: { kind: SpinSuccess["kind"] }) {
  const className = "size-7";
  if (kind === "points") return <Sparkles className={className} />;
  if (kind === "bundle") return <Crown className={className} />;
  return <Ticket className={className} />;
}

/** The one line that says what the customer actually holds now. */
function prizeTerms(result: SpinSuccess): string[] {
  const terms: string[] = [];
  if (result.kind === "points") {
    terms.push("Оноо шууд зарцуулагдах боломжтой.");
    terms.push(`Одоогийн үлдэгдэл: ${result.points.toLocaleString("mn-MN")}V`);
    return terms;
  }
  if (result.kind === "bundle") {
    terms.push("Дараагийн захиалгад тань үнэгүй хавсаргана.");
    terms.push("Ажилтан тантай холбогдож баталгаажуулна.");
    return terms;
  }
  if (result.minSubtotal > 0) {
    terms.push(`${formatPrice(result.minSubtotal)}-с дээш захиалгад`);
  } else {
    terms.push("Доод хязгааргүй");
  }
  if (result.maxDiscount) {
    terms.push(`Дээд хөнгөлөлт ${formatPrice(result.maxDiscount)}`);
  }
  if (result.couponExpiresAt) {
    terms.push(`${formatDate(result.couponExpiresAt)} хүртэл хүчинтэй`);
  }
  return terms;
}

export function PrizeReveal({
  result,
  open,
  onClose,
}: {
  result: SpinSuccess | null;
  open: boolean;
  onClose: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) setCopied(false);
  }, [open, result?.couponCode]);

  if (!result) return null;
  const grand = result.tier === "grand";

  const copy = async () => {
    if (!result.couponCode) return;
    try {
      await navigator.clipboard.writeText(result.couponCode);
      setCopied(true);
      toast.success("Купоны код хуулагдлаа");
    } catch {
      toast.error("Хуулж чадсангүй — кодоо гараар тэмдэглэнэ үү");
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={TIER_TITLE[result.tier]}
      className="sm:max-w-md"
    >
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <motion.div
          initial={reduced ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className={cn(
            "grid size-20 place-items-center rounded-full",
            grand ? "bg-gold text-background" : "bg-secondary text-foreground",
          )}
        >
          <PrizeIcon kind={result.kind} />
        </motion.div>

        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">
            {result.label}
          </p>
          {result.pointsSpent > 0 && (
            <p className="text-muted-foreground text-xs">
              {result.pointsSpent.toLocaleString("mn-MN")}V зарцуулав
            </p>
          )}
        </div>

        {result.couponCode && (
          <div className="bg-secondary w-full rounded-xl p-4">
            <p className="text-muted-foreground mb-2 text-xs">Купоны код</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-lg font-semibold tracking-[0.2em]">
                {result.couponCode}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={copy}
                aria-label="Купоны код хуулах"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <ul className="text-muted-foreground space-y-1 text-sm">
          {prizeTerms(result).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {result.couponCode && (
          <p className="text-muted-foreground/80 flex items-start gap-2 text-left text-xs">
            <Gift className="mt-0.5 size-3.5 shrink-0" />
            Хүрднээс авсан купон нэг дор нэг л байна — шинийг хожвол өмнөх
            ашиглагдаагүй купон солигдоно.
          </p>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/catalog">Дэлгүүр үзэх</Link>
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Хаах
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
