"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { couponTerms } from "@/features/account/components/coupons";

/**
 * The coupon field in the order summary.
 *
 * It replaced a bare input beside a row of grey pills that showed only a code
 * and a number. Two things made that worse than it looks: a customer cannot
 * tell `VW7K2X` from `VWQ13B` at a glance, and since the lucky wheel started
 * letting coupons accumulate (docs/lucky-wheel.md §0) they may hold several at
 * once — so the field's real job is to answer "which of mine saves the most
 * here?", not "type a code".
 *
 * Хураангуйд үргэлж НЭГ мөр: сонгосон купон (`код · −дүн · Солих`), эсвэл
 * «N купон байна · Сонгох». Өмнө нь санал бүр карт болж жагсдаг байсан тул 5
 * купонтой хүний тойм ~1340px болж, «Төлбөр төлөх» нь десктоп дээр ч fold-оос
 * доош ордог байв. Бүх санал, гараар код оруулах нь `ResponsiveDialog` дотор.
 *
 * `/api/coupons/available` only ever returns coupons that validate against the
 * current subtotal — so every usable row is one tap from working. Rows arrive
 * soonest-expiry first and are never merged (0104): two 10% codes ending on
 * different days are two rows, each with its own date and terms.
 */

export function CouponField({
  applied,
  autoApplied = false,
  offers,
  code,
  onCodeChange,
  onApply,
  applying,
  loading = false,
  message,
  onPick,
  onRemove,
  walletHref,
}: {
  applied: { code: string; discount: number } | null;
  /** Одоогийн купоныг хэрэглэгч биш, хуудас өөрөө сонгосон. */
  autoApplied?: boolean;
  offers: AvailableCoupon[];
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
  /** Санал болгох купонуудыг сервер хайж байна. */
  loading?: boolean;
  message: string | null;
  onPick: (coupon: AvailableCoupon) => void;
  onRemove: () => void;
  /** «Миний купоныг харах» — the full wallet, beyond the few offered here. */
  walletHref?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Гараар оруулсан код dialog дотор хүчинтэй болмогц dialog хаагдана —
  // render-ийн үеийн state тохируулга (effect биш).
  const appliedCode = applied?.code ?? null;
  const [seenCode, setSeenCode] = React.useState(appliedCode);
  if (seenCode !== appliedCode) {
    setSeenCode(appliedCode);
    if (appliedCode) setOpen(false);
  }

  const usable = offers.filter((o) => o.eligible);
  const top = Math.max(0, ...usable.map((o) => o.discount));

  let row: React.ReactNode;
  if (applied) {
    row = (
      <div className="bg-secondary flex items-center gap-2.5 rounded-xl py-2 pr-1 pl-3">
        <Check
          className="text-gold-strong size-4 shrink-0"
          strokeWidth={2.5}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="truncate font-mono font-semibold">
              {applied.code}
            </span>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-gold-strong shrink-0 font-semibold tabular-nums">
              −{formatPrice(applied.discount)}
            </span>
          </span>
          {autoApplied && (
            <span className="text-muted-foreground block text-xs">
              Хамгийн их хэмнэлттэйг сонголоо
            </span>
          )}
        </span>
        <ChangeButton onClick={() => setOpen(true)}>
          {offers.length > 1 ? `Солих (${offers.length})` : "Солих"}
        </ChangeButton>
        {/* 16px дүрс, 44px хүрэх талбар (WCAG 2.5.8). */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Купон хасах"
          className="text-muted-foreground hover:text-destructive relative flex size-8 shrink-0 items-center justify-center transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  } else if (loading && offers.length === 0) {
    // Хайлт дуусаагүй байхад «купон байхгүй» гэж шийдэхгүй — эс тэгвээс input
    // гарч ирээд, санал ирэхэд нь дахин алга болж анивчина.
    row = (
      <div
        className="bg-secondary h-11 w-full animate-pulse rounded-xl"
        aria-hidden
      />
    );
  } else if (usable.length > 0) {
    row = (
      <div className="bg-secondary flex items-center gap-2.5 rounded-xl py-2 pr-1 pl-3">
        <Tag className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block">{usable.length} купон ашиглах боломжтой</span>
          <span className="text-muted-foreground block text-xs">
            Хамгийн ихдээ{" "}
            <span className="text-gold-strong font-semibold tabular-nums">
              −{formatPrice(top)}
            </span>
          </span>
        </span>
        <ChangeButton onClick={() => setOpen(true)}>Сонгох</ChangeButton>
      </div>
    );
  } else {
    // Ашиглах купон алга — гараар оруулах нь энд шууд, dialog-гүй.
    row = (
      <ManualEntry
        code={code}
        onCodeChange={onCodeChange}
        onApply={onApply}
        applying={applying}
      />
    );
  }

  // Хэрэглэх боломжгүй (доод дүнд хүрээгүй) купон л байгаа үед тэдгээрийг
  // жагсаалтаар нь харах зам.
  const lockedOnly = !applied && !loading && usable.length === 0;

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">Купон</p>
      {row}
      {!open && message && <Message text={message} />}
      {lockedOnly && (offers.length > 0 || walletHref) && (
        <LinkRow>
          {offers.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={LINK_CLASS}
            >
              Бусад купон ({offers.length})
            </button>
          )}
          {walletHref && <WalletLink href={walletHref} />}
        </LinkRow>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Купон сонгох"
        description="Нэг захиалгад нэг купон хэрэглэнэ."
      >
        <div className="space-y-4">
          {offers.length > 0 && (
            <OfferList
              offers={offers}
              appliedCode={appliedCode}
              onPick={(o) => {
                onPick(o);
                setOpen(false);
              }}
            />
          )}
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              Код оруулах
            </p>
            <ManualEntry
              code={code}
              onCodeChange={onCodeChange}
              onApply={onApply}
              applying={applying}
            />
            {message && <Message text={message} />}
          </div>
          {walletHref && (
            <LinkRow>
              <WalletLink href={walletHref} />
            </LinkRow>
          )}
        </div>
      </ResponsiveDialog>
    </div>
  );
}

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 transition-colors hover:underline";

/** Холбоосуудыг хооронд нь `·`-ээр тусгаарласан мөр — нийлж уншигдахгүй. */
function LinkRow({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="text-muted-foreground text-xs" aria-hidden>
              ·
            </span>
          )}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}

function WalletLink({ href }: { href: string }) {
  return (
    <Link href={href} className={LINK_CLASS}>
      Миний купоныг харах <ArrowRight className="size-3" />
    </Link>
  );
}

function ChangeButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 shrink-0 px-2.5 text-xs font-semibold"
    >
      {children}
    </Button>
  );
}

function Message({ text }: { text: string }) {
  return (
    <p role="alert" className="text-destructive text-xs">
      {text}
    </p>
  );
}

function ManualEntry({
  code,
  onCodeChange,
  onApply,
  applying,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="Купон код"
        aria-label="Купон код"
        // Codes are printed uppercase; typing them lowercase and seeing
        // them stay lowercase reads as "this isn't the code I was given".
        className="h-10 font-mono uppercase placeholder:font-sans placeholder:normal-case md:h-9"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onApply();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        className="h-10 shrink-0 md:h-9"
        disabled={applying || !code.trim()}
        onClick={onApply}
      >
        {applying ? "…" : "Хэрэглэх"}
      </Button>
    </div>
  );
}

function OfferList({
  offers,
  appliedCode,
  onPick,
}: {
  offers: AvailableCoupon[];
  appliedCode: string | null;
  onPick: (coupon: AvailableCoupon) => void;
}) {
  // Rows are ordered by expiry, so the biggest saving is not necessarily the
  // first one — mark it wherever it sits, and only if it is a clear winner.
  const usable = offers.filter((o) => o.eligible);
  const top = Math.max(0, ...usable.map((o) => o.discount));
  const bestId =
    usable.length > 1 && usable.filter((o) => o.discount === top).length === 1
      ? usable.find((o) => o.discount === top)?.id
      : undefined;
  return (
    <ul className="space-y-2">
      {offers.map((o) => (
        <li key={o.id}>
          <OfferRow
            offer={o}
            best={o.id === bestId}
            active={o.code === appliedCode}
            onPick={() => onPick(o)}
          />
        </li>
      ))}
    </ul>
  );
}

function OfferRow({
  offer,
  best,
  active,
  onPick,
}: {
  offer: AvailableCoupon;
  best: boolean;
  /** Одоо хэрэглэгдэж буй купон. */
  active: boolean;
  onPick: () => void;
}) {
  const expiry = expiryNote(offer.endsAt);
  const terms = couponTerms(offer);
  const locked = !offer.eligible;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={locked}
      aria-pressed={active}
      // Хүрээ энэ системд тунгалаг тул мөрүүд огт хилгүй, дарж болохгүй текст
      // мэт харагддаг байв. Мөрийг `bg-secondary` дээр, доторх тэмдгийг нэг
      // давхарга ухааж (`bg-card`) тавьснаар хоёулаа уншигдана.
      className={cn(
        "bg-secondary enabled:hover:bg-accent flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-2 ring-transparent transition-all disabled:cursor-not-allowed",
        active && "ring-foreground",
      )}
    >
      {/* What the coupon *is*, so two codes are told apart without reading
          either of them. */}
      <span className="bg-card flex size-11 shrink-0 flex-col items-center justify-center rounded-lg">
        <Tag className="text-muted-foreground mb-0.5 size-3" />
        <span className="text-[11px] leading-none font-bold">
          {offer.type === "percent"
            ? `${offer.value}%`
            : compactAmount(offer.value)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-mono text-xs font-semibold">
            {offer.code}
          </span>
          {offer.personal && (
            <span className="bg-card text-muted-foreground rounded-full px-1.5 py-px text-[11px] font-medium">
              Танд
            </span>
          )}
          {active && (
            <span className="bg-card text-foreground rounded-full px-1.5 py-px text-[11px] font-semibold">
              Хэрэглэж байна
            </span>
          )}
          {best && (
            <span className="bg-foreground text-background rounded-full px-1.5 py-px text-[11px] font-semibold">
              Хамгийн их
            </span>
          )}
        </span>
        {(expiry || terms) && (
          <span className="text-muted-foreground mt-0.5 block text-[11px]">
            {expiry && (
              <span className={cn(expiry.urgent && "text-destructive")}>
                {expiry.label}
              </span>
            )}
            {expiry && terms && " · "}
            {terms}
          </span>
        )}
        {/* Доод дүнд хүрээгүй: нөхцөлийг нь хэлж, хэдийг нэмэхийг тоолж өгнө. */}
        {locked && offer.shortfall > 0 && (
          <span className="text-foreground mt-0.5 block text-[11px] font-medium">
            Дахин {formatPrice(offer.shortfall)}-ийн бараа нэмбэл ашиглана
          </span>
        )}
      </span>

      {!locked && (
        <span className="text-gold-strong shrink-0 text-sm font-semibold">
          −{formatPrice(offer.discount)}
        </span>
      )}
    </button>
  );
}

/** "10,000₮" is too wide for a 44px tile; "10мянга" is not a thing. */
function compactAmount(value: number): string {
  return value >= 1000 ? `${Math.round(value / 1000)}мянга` : `${value}₮`;
}

/**
 * When the coupon ends. Rows are no longer merged, so the date is what tells
 * two otherwise identical coupons apart: a countdown when it is close enough
 * to act on, the plain date otherwise.
 */
function expiryNote(
  endsAt: string | null,
): { label: string; urgent: boolean } | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  if (days > 7) return { label: `${formatDate(endsAt)} хүртэл`, urgent: false };
  return {
    label: days <= 1 ? "Өнөөдөр дуусна" : `${days} хоногийн дараа дуусна`,
    urgent: days <= 3,
  };
}
