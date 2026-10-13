"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useFeatureFlag } from "@/components/feature-flags";
import { useProfileSummary } from "@/features/account/use-profile-summary";
import { CouponTicket } from "@/features/account/components/coupon-ticket";
import { CopyCodeButton } from "@/features/account/components/coupon-actions";
import { suppressPromoPopup } from "@/features/marketing/components/promo-popup";
import { formatDate, formatPrice } from "@/lib/format";
import type { WelcomeGift } from "../types";

/**
 * Энэ төхөөрөмж дээр аль бүртгэлийг шалгаад «бэлэггүй» гэж мэдсэн бэ.
 * Бэлэг зөвхөн бүртгүүлэх мөчид олгогддог тул нэг шалгалт хангалттай —
 * хуудас ачаалах бүрд API руу явахгүй. Хадгалагдахгүй (private цонх) бол
 * зүгээр л дахин нэг удаа асууна.
 */
const CHECKED_KEY = "vs:welcome-gift-checked";

function readChecked(): string | null {
  try {
    return window.localStorage.getItem(CHECKED_KEY);
  } catch {
    return null;
  }
}

function writeChecked(handle: string) {
  try {
    window.localStorage.setItem(CHECKED_KEY, handle);
  } catch {
    // Хадгалж чадахгүй бол дараагийн ачаалалт дахин асууна — хор хөнөөлгүй.
  }
}

/**
 * Энэ document-д нэг удаа. Цонх нь (shop) ба (account) layout тус бүрд
 * mount болдог тул layout солигдох бүрд шинэ instance үүсдэг — instance-ийн
 * ref ба таб даяар хадгалагдах query кэш хоёр нийлээд «Миний купон» → «Үнэр
 * сонгох» бүрд цонхыг дахин нээдэг байв. Модулийн хувьсагч client navigation-ыг
 * давж хадгалагдана.
 */
let shownForThisDocument = false;

async function fetchGift(): Promise<WelcomeGift | null> {
  const res = await fetch("/api/campaigns/welcome", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    gift?: WelcomeGift | null;
  } | null;
  return body?.gift ?? null;
}

/**
 * Шинэ хэрэглэгчийн мэндчилгээ (кампанит ажил, 0135): бүртгүүлэхэд авсан
 * купоныг НЭГ удаа харуулна. Бүртгэл нь шууд нэвтрүүлдэг тул бүртгүүлсний
 * дараах эхний хуудас = «анхны login».
 *
 * Нээгдмэгц `notified_at` тэмдэглэгдэнэ — хаасан эсэхээс үл хамааран дахин
 * гарахгүй. Купон нь «Миний купон»-д үргэлж байгаа тул алдах зүйлгүй.
 * Сурталчилгааны popup тухайн document-д гарахгүй: хоёр цонх давхарлахгүй.
 */
export function WelcomeGiftDialog() {
  const enabled = useFeatureFlag("campaigns");
  const { profile } = useProfileSummary();
  const handle = profile?.handle ?? null;
  const [checked, setChecked] = React.useState<string | null | undefined>(
    undefined,
  );
  React.useEffect(() => setChecked(readChecked()), []);

  const shouldAsk =
    enabled &&
    handle !== null &&
    checked !== undefined &&
    checked !== handle &&
    !profile?.isStaff;

  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["campaign-welcome", handle], [handle]);
  const { data: fetched } = useQuery({
    queryKey,
    queryFn: fetchGift,
    enabled: shouldAsk,
    staleTime: Infinity,
    retry: false,
  });

  const [open, setOpen] = React.useState(false);
  // Харуулж буй бэлэг — кэшийг цэвэрлэсний дараа ч нээлттэй цонх хоосрохгүй.
  const [gift, setGift] = React.useState<WelcomeGift | null>(null);

  React.useEffect(() => {
    if (!handle || fetched === undefined || shownForThisDocument) return;
    writeChecked(handle);
    if (!fetched) return;
    shownForThisDocument = true;
    setGift(fetched);
    setOpen(true);
    suppressPromoPopup();
    // Кэшид «бэлэггүй» гэж бичнэ: дараагийн mount (өөр layout) дахин нээхгүй.
    queryClient.setQueryData(queryKey, null);
    void fetch("/api/campaigns/welcome", { method: "POST" }).catch(() => {});
  }, [fetched, handle, queryClient, queryKey]);

  if (!gift) return null;

  const close = () => setOpen(false);
  const amount = formatPrice(gift.value);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Тавтай морил!"
      className="sm:max-w-md"
    >
      <div className="flex flex-col gap-6 pt-2 pb-1">
        <p className="text-muted-foreground text-sm/relaxed">
          Танд{" "}
          <span className="text-foreground font-medium">
            {amount}-ийн купон
          </span>{" "}
          бэлэглэж байна. Та дараагийн захиалгадаа ашиглаарай.
        </p>

        <CouponTicket
          type="fixed"
          value={gift.value}
          code="Бэлгийн купон"
          onCard
        >
          {gift.endsAt && (
            <p className="truncate">{formatDate(gift.endsAt)} хүртэл</p>
          )}
          <p className="truncate">
            {gift.minSubtotal > 0
              ? `${formatPrice(gift.minSubtotal)}-өөс дээш захиалгад`
              : "Ямар ч захиалгад"}
          </p>
        </CouponTicket>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Купоны код</p>
          <div className="bg-secondary flex items-center justify-between gap-3 rounded-xl py-1.5 pr-1.5 pl-4">
            <code className="font-semibold tracking-[0.2em]">{gift.code}</code>
            <CopyCodeButton code={gift.code} />
          </div>
          <p className="text-muted-foreground text-xs">
            Купон тань «Миний купон»-д хадгалагдсан — захиалга хийхдээ сонгоход
            л болно. Та купоноо өөр хүнд өгч болно. Харин тухайн хүн купоныг
            ашиглавал таны купон ашиглагдсанд тооцогдоно.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/catalog" onClick={close}>
              Үнэр сонгох
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/account/coupons" onClick={close}>
              Миний купон
            </Link>
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
