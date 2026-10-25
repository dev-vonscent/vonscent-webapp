import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  MessageSquarePlus,
  Package,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  REVIEW_REJECT_REASON_LABEL,
  REVIEW_STATUS_LABEL,
  type ReviewRejectReason,
  type ReviewStatus,
} from "@/lib/constants";

export interface ReviewableItem {
  /** `p:<productId>` эсвэл `c:<collectionId>` — base багцаар авсан бол багц. */
  key: string;
  /** Сэтгэгдлийн хэсэгтэй хуудас: `/products/<slug>` эсвэл `/collections/<slug>`. */
  href: string;
  /** «Брэнд Нэр» эсвэл багцын нэр. */
  title: string;
  image: string | null;
  /** Хэрэглэгч энэ усанд аль хэдийн сэтгэгдэл бичсэн эсэх. */
  reviewed: boolean;
  /** Туг `review_moderation` (0162) нээлттэй, сэтгэгдэл бичсэн үед л. */
  moderation?: {
    status: ReviewStatus;
    rejectReason: ReviewRejectReason | null;
    /** Олгосон оноо (`review_rewards`); олгоогүй бол 0. */
    rewardPoints: number;
  };
}

/** Шалгагдаж байна / Оноо цуглуулсан / Цуцлагдсан (шалтгаантай). */
function ModerationStatus({
  moderation,
}: {
  moderation: NonNullable<ReviewableItem["moderation"]>;
}) {
  const { status, rejectReason, rewardPoints } = moderation;
  if (status === "pending") {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Clock className="size-3.5" />
        {REVIEW_STATUS_LABEL.pending}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="flex flex-col items-end gap-0.5 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="text-success size-3.5" />
          Баталгаажсан. Баярлалаа!
        </span>
        {/* Оноо 0 үед батлагдсан ч оноо олгогдоогүй. */}
        {rewardPoints > 0 && (
          <span className="text-gold-strong font-semibold tabular-nums">
            +{rewardPoints.toLocaleString("mn-MN")} V point цуглуулсан
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end text-xs">
      <span className="text-destructive flex items-center gap-1.5">
        <XCircle className="size-3.5" />
        {REVIEW_STATUS_LABEL.rejected}
      </span>
      {rejectReason && (
        <span className="text-muted-foreground">
          {REVIEW_REJECT_REASON_LABEL[rejectReason]}
        </span>
      )}
    </span>
  );
}

/**
 * «Миний захиалга»-ын дэлгэрэнгүй дээрх сэтгэгдлийн урилга (0117).
 *
 * Хүргэгдэхээс өмнө зөвхөн урилгын зурвас; хүргэгдсэний дараа ус бүрт
 * барааны хуудасны сэтгэгдлийн хэсэг рүү үсрэх товч. Оноо нь сэтгэгдэл
 * бичигдэх үед DB-ийн trigger-ээр олгогдоно — энд зөвхөн харуулна.
 */
export function OrderReviewPrompt({
  delivered,
  reviewPoints,
  items,
}: {
  delivered: boolean;
  reviewPoints: number;
  items: ReviewableItem[];
}) {
  if (items.length === 0) return null;
  const reward =
    reviewPoints > 0
      ? ` +${reviewPoints.toLocaleString("mn-MN")} V point цуглуулаарай`
      : "";

  if (!delivered) {
    return (
      <p className="bg-secondary text-muted-foreground rounded-xl px-4 py-3 text-sm">
        Бараагаа хэрэглэж үзээд сэтгэгдлээ бичээд
        {reward || " бусдад туслаарай"}. Захиалга хүргэгдсэний дараа сэтгэгдэл
        бичих товч энд гарна.
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Сэтгэгдэл бичих</h2>
          <p className="text-muted-foreground text-sm">
            Бараагаа хэрэглэж үзээд сэтгэгдлээ бичээд
            {reward
              ? `${reward} (ус, багц бүрт нэг удаа)`
              : " бусдад туслаарай"}
            .
          </p>
        </div>
        <ul className="divide-border divide-y">
          {items.map((i) => (
            <li
              key={i.key}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="border-border bg-secondary relative size-12 shrink-0 overflow-hidden rounded-lg border">
                {i.image ? (
                  <Image
                    src={i.image}
                    alt={i.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Package className="text-muted-foreground size-5" />
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm">{i.title}</p>
              {i.moderation ? (
                <div className="shrink-0 text-right">
                  <ModerationStatus moderation={i.moderation} />
                </div>
              ) : i.reviewed ? (
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href={`${i.href}#reviews`}>
                    <CheckCircle2 className="text-success size-4" />
                    Бичсэн
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`${i.href}#reviews`}>
                    <MessageSquarePlus className="size-4" />
                    Сэтгэгдэл бичих
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
