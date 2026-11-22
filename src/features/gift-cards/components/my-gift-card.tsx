"use client";

import * as React from "react";
import { Copy, Download, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { formatGiftAmount, GIFT_STATUS_LABEL } from "../lib";
import type { MyGiftCard } from "../types";
import { GiftCardFace } from "./gift-card-face";
import { GiftCardSendButton } from "./gift-card-send";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Хуулж чадсангүй. Гараар сонгож хуулна уу.");
  }
}

const STATUS_TONE: Record<MyGiftCard["status"], string> = {
  pending: "bg-secondary text-muted-foreground",
  active: "bg-success/10 text-success",
  redeemed: "bg-secondary text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
  void: "bg-secondary text-muted-foreground",
};

function StatusPill({ status }: { status: MyGiftCard["status"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
      )}
    >
      {GIFT_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Картын ар тал — код (нууц), QR, хугацаа. Нүүртэй ижил 1200×756 харьцаа,
 * загварын өнгөөр; хэмжээ нь `cqw`-ээр (GiftCardFace-тэй адил).
 */
function GiftCardBack({
  card,
  qrSrc,
  onFlip,
  flipRef,
}: {
  card: MyGiftCard;
  qrSrc: string;
  onFlip: () => void;
  flipRef: React.Ref<HTMLButtonElement>;
}) {
  const u = (px: number) => `${(px / 12).toFixed(3)}cqw`;
  const d = card.design;
  return (
    <div
      className="@container relative aspect-1200/756 w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: d.bgColor, color: d.textColor }}
    >
      <span
        aria-hidden="true"
        className="brand-mark absolute block aspect-233/240"
        style={{ left: u(64), top: u(48), height: u(72) }}
      />
      <div className="absolute" style={{ left: u(64), top: u(250) }}>
        <div
          className="font-medium tracking-[0.2em] uppercase"
          style={{ fontSize: u(26), color: d.mutedColor }}
        >
          Бэлгийн код
        </div>
        <div className="flex items-center" style={{ marginTop: u(12), gap: u(18) }}>
          <div
            className="font-mono font-bold tracking-wider select-all"
            style={{ fontSize: u(64), lineHeight: 1 }}
          >
            {card.code}
          </div>
          <button
            type="button"
            onClick={() => copy(card.code ?? "", "Код хуулагдлаа.")}
            aria-label="Кодыг хуулах"
            className="relative z-20 flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-current"
            style={{
              width: u(64),
              height: u(64),
              backgroundColor: `${d.textColor}1a`,
            }}
          >
            <Copy className="size-[45%]" aria-hidden="true" />
          </button>
        </div>
        {card.expiresAt && (
          <div style={{ marginTop: u(24), fontSize: u(28), lineHeight: 1.35, maxWidth: u(700), color: d.mutedColor }}>
            {formatDate(card.expiresAt)} хүртэл оноо болгох боломжтой
          </div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- жижиг PNG, optimizer хэрэггүй */}
      <img
        src={qrSrc}
        alt="Бэлгийн хуудас руу орох QR"
        className="absolute rounded-[3cqw] bg-white"
        style={{
          right: u(64),
          top: u(190),
          width: u(300),
          height: u(300),
          padding: u(14),
        }}
      />
      <div
        className="absolute"
        style={{ left: u(64), bottom: u(48), fontSize: u(22), color: d.mutedColor }}
      >
        vonscent.mn
      </div>
      {/* Ар тал дээр дахин дарахад нүүр рүү — хуулах товч (z-20) дээгүүр. */}
      <button
        ref={flipRef}
        type="button"
        onClick={onFlip}
        aria-label="Картын нүүр тал руу эргүүлэх"
        className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </div>
  );
}

/**
 * «Миний бэлгийн карт»-ын нэг карт (gift-cards-plan §2.2). Ашиглагдаагүй,
 * миний худалдаж авсан карт эргэж ар талдаа кодоо харуулна — бусад нь
 * зөвхөн нүүр (код нь хэрэггүй/нууц).
 */
export function MyGiftCardItem({
  card,
  url,
}: {
  card: MyGiftCard;
  /** `/gift/<token>` бүтэн холбоос — зөвхөн хуваалцах боломжтой үед. */
  url: string | null;
}) {
  const [flipped, setFlipped] = React.useState(false);
  const frontRef = React.useRef<HTMLButtonElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  // Эргүүлсний дараа focus нөгөө тал руу — далд тал `inert` тул focus тэнд
  // үлдэхгүй (keyboard, screen reader). Анх mount-д хөдлөхгүй.
  const flippedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!flippedOnce.current) {
      flippedOnce.current = true;
      return;
    }
    (flipped ? backRef : frontRef).current?.focus({ preventScroll: true });
  }, [flipped]);
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const shareable = Boolean(card.code && card.token && url);
  const bought = card.role === "bought";
  const done = card.status === "redeemed" || card.status === "expired";

  async function share() {
    if (!url) return;
    try {
      await navigator.share({
        title: "Vonscent бэлгийн карт",
        text: `${card.recipientName}, танд Vonscent-ийн бэлгийн карт илгээлээ.`,
        url,
      });
    } catch {
      // Хэрэглэгч цуцалсан.
    }
  }

  const meta = bought
    ? card.status === "redeemed" && card.redeemedAt
      ? `${formatDate(card.redeemedAt)}-нд оноо болгосон`
      : card.status === "expired"
        ? "Хугацаа дууссан — ашиглагдаагүй"
        : card.recipientEmail
          ? card.sentAt
            ? `${card.recipientEmail} руу илгээсэн`
            : card.sendAt && new Date(card.sendAt) > new Date()
              ? `${card.recipientEmail} руу ${formatDate(card.sendAt)}-нд илгээгдэнэ`
              : `${card.recipientEmail} руу илгээгдэнэ`
          : "Та өөрөө өгнө — холбоос эсвэл кодоо хуваалцаарай"
    : `${card.redeemedAt ? `${formatDate(card.redeemedAt)}-нд ` : ""}${(card.points ?? card.amount).toLocaleString("mn-MN")} V point дансанд орсон`;

  return (
    <li className="min-w-0">
      <div className="perspective-[1600px]">
        <div
          className={cn(
            "relative transform-3d transition-transform duration-500 ease-out motion-reduce:transition-none",
            flipped && "rotate-y-180",
          )}
        >
          <div className="backface-hidden" inert={flipped}>
            <GiftCardFace
              design={card.design}
              text={card}
              className={cn(done && "opacity-55")}
            />
            {shareable && (
              <button
                ref={frontRef}
                type="button"
                onClick={() => setFlipped(true)}
                className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Картыг эргүүлж кодыг харах"
              />
            )}
          </div>
          {shareable && card.token && (
            <div
              className="absolute inset-0 rotate-y-180 backface-hidden"
              inert={!flipped}
            >
              <GiftCardBack
                card={card}
                qrSrc={`/api/gift-cards/${card.token}/qr`}
                onFlip={() => setFlipped(false)}
                flipRef={backRef}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {bought ? card.recipientName : `Илгээгч: ${card.fromName}`}
            <span className="text-muted-foreground font-normal">
              {" · "}
              {formatGiftAmount(card.amount)}
            </span>
          </p>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm wrap-break-word">{meta}</p>
        </div>
        <StatusPill status={card.status} />
      </div>

      {shareable && url && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canShare ? (
            <Button type="button" size="sm" variant="secondary" onClick={share}>
              <Share2 className="size-4" aria-hidden="true" />
              Хуваалцах
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                copy(url, "Холбоос хуулагдлаа — Messenger-ээр илгээж болно.")
              }
            >
              <Link2 className="size-4" aria-hidden="true" />
              Холбоос хуулах
            </Button>
          )}
          {/* Картын нүүр (код, QR-гүй) — Messenger, story-д хавсаргах. */}
          <Button asChild size="sm" variant="secondary">
            <a href={`/api/gift-cards/${card.token}/image?download=1`} download>
              <Download className="size-4" aria-hidden="true" />
              Зураг татах
            </a>
          </Button>
          <GiftCardSendButton
            cardId={card.id}
            currentEmail={card.recipientEmail}
            sent={Boolean(card.sentAt)}
            size="sm"
          />
        </div>
      )}
    </li>
  );
}
