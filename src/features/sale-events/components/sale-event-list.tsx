"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarRange,
  Copy,
  Ellipsis,
  ExternalLink,
  Package,
  Plus,
  Square,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useFeatureFlag } from "@/components/feature-flags";
import { ubToday } from "@/features/admin/lib/date-range";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatEventPeriod, saleEventPhase } from "../lib";
import type { SaleEventAdminRow, SaleEventPhase } from "../types";
import { PhaseBadge } from "./phase-badge";
import {
  firstProblem,
  studioChecklist,
  type StudioBanner,
} from "./studio/studio-checklist";
import { discountRange, draftFromRow, pctSpan } from "./studio/studio-model";

const NEW_HREF = "/admin/sale-events/new";

/**
 * Админ → Маркетинг → Арга хэмжээ — жагсаалт (studio-ux.md §4.1).
 *
 * Арга хэмжээ = нэртэй, хугацаатай хямдрал (Black Friday, Цагаан сар …).
 * Карт бүхэлдээ студи рүү; үүсгэх / засах нь бүтэн хуудсанд (drawer биш).
 * Одоо байгаа гар хямдралыг (Хямдрал → Бараагаар) ДАРАХГҮЙ: хоёулаа байвал
 * хэрэглэгч хамгийн хямдыг нь төлнө, арга хэмжээ дуусахад бүгд өөрөө буцна.
 */
export function SaleEventList({
  rows,
  banners,
}: {
  rows: SaleEventAdminRow[];
  /** Арга хэмжээний id → холбоотой баннер (`hero_admin` нээлттэй үед). */
  banners: Record<string, StudioBanner>;
}) {
  const router = useRouter();
  const bannerEnabled = useFeatureFlag("hero_admin");
  const [confirm, confirmDialog] = useConfirm();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  // Төлөв цагаас хамаарна — серверийн рендерт биш, хөтөч дээр тооцно.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => setNow(Date.now()), []);

  async function stop(e: SaleEventAdminRow, phase: SaleEventPhase) {
    const ok = await confirm({
      title: `«${e.name}»-г зогсоох уу?`,
      description:
        phase === "live"
          ? "Үнэ яг одоо үндсэн (эсвэл өмнөх гар хямдрал) руугаа буцна. Арга хэмжээ түүхэнд үлдэнэ."
          : "Нийтлэлээс буцаж ноорог болно. Дэлгүүрт юу ч өөрчлөгдөхгүй.",
      confirmLabel: "Зогсоох",
      destructive: phase === "live",
    });
    if (!ok) return;
    setBusyId(e.id);
    try {
      const done = await mutateJson(
        `/api/admin/sale-events/${e.id}`,
        "PATCH",
        { action: "stop" },
        "Зогсоож чадсангүй",
      );
      if (!done) return;
      toast.success(`«${e.name}» зогслоо.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(e: SaleEventAdminRow) {
    const ok = await confirm({
      title: `«${e.name}»-г устгах уу?`,
      description: "Ноорог бүрэн устгагдана.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusyId(e.id);
    try {
      const done = await mutateJson(
        `/api/admin/sale-events/${e.id}`,
        "DELETE",
        {},
        "Устгасангүй",
      );
      if (!done) return;
      toast.success("Ноорог устлаа.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const create = (
    <Button asChild size="sm">
      <Link href={NEW_HREF}>
        <Plus className="size-4" />
        Арга хэмжээ үүсгэх
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Арга хэмжээ"
        count={rows.length}
        description="Black Friday, Цагаан сар, Наадам г.м. нэртэй, хугацаатай хямдрал. Хугацаа эхлэхэд үнэ буурч, каталогт шүүлтүүр гарна; дуусахад бүгд өөрөө буцна. Одоо байгаа хямдралыг дарахгүй — хоёулаа байвал хамгийн хямд нь."
        actions={rows.length > 0 && create}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Tag}
          surface="card"
          title="Арга хэмжээ хараахан алга"
          description="Жишээ нь: Black Friday, 11/23–11/30, сонгосон үнэртэнд 20–30%. Бараа, хэмжээ бүрд өөр хувь өгч болно."
          action={create}
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((e) => (
            <li key={e.id}>
              <EventCard
                event={e}
                now={now}
                banner={banners[e.id] ?? null}
                bannerEnabled={bannerEnabled}
                busy={busyId === e.id}
                onStop={(phase) => stop(e, phase)}
                onRemove={() => remove(e)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({
  event: e,
  now,
  banner,
  bannerEnabled,
  busy,
  onStop,
  onRemove,
}: {
  event: SaleEventAdminRow;
  now: number | null;
  banner: StudioBanner | null;
  bannerEnabled: boolean;
  busy: boolean;
  onStop: (phase: SaleEventPhase) => void;
  onRemove: () => void;
}) {
  const phase = now == null ? null : saleEventPhase(e, now);
  const range = discountRange(e.items);
  const span = pctSpan(range);
  // Дутуу зүйл — нэг мөр (§4.1). Дууссанд хамаагүй.
  const problem =
    now == null || phase === "ended"
      ? null
      : firstProblem(
          studioChecklist({
            draft: draftFromRow(e),
            today: ubToday(new Date(now)),
            banner,
            bannerEnabled,
          }),
        );
  const canStop = phase === "live" || phase === "scheduled";

  return (
    <Card className={cn("relative", phase === "ended" && "bg-card/60")}>
      <CardContent className="flex items-start gap-4 p-4 sm:p-5">
        {bannerEnabled && (
          <div className="bg-muted text-muted-foreground hidden aspect-14/5 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs sm:flex">
            {banner?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- жижиг thumbnail, storage URL
              <img
                src={banner.thumb}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              "Баннергүй"
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg font-semibold wrap-break-word">
              {/* Карт бүхэлдээ дарагдана: холбоосын `after` картыг бүрхэнэ. */}
              <Link
                href={`/admin/sale-events/${e.id}`}
                className="after:absolute after:inset-0 after:rounded-[inherit]"
              >
                {e.name}
              </Link>
            </h2>
            {phase && <PhaseBadge phase={phase} />}
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarRange className="size-3.5" />
              {formatEventPeriod(e.startsAt, e.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Package className="size-3.5" />
              {e.items.length} бараа · {span ? `хямдрал ${span}` : "хувьгүй"}
            </span>
          </p>
          {problem && (
            <p
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                problem.level === "error" ? "text-destructive" : "text-warning",
              )}
            >
              <AlertCircle className="size-3.5 shrink-0" />
              {problem.text}
            </p>
          )}
          {phase === "ended" && (
            <p className="text-muted-foreground text-xs">
              Дууссан — дахин явуулах бол хуулна уу.
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={`«${e.name}» — үйлдлүүд`}
              className="relative z-10 shrink-0"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canStop && (
              <DropdownMenuItem asChild>
                <a
                  href={`/catalog?event=${e.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink />
                  Дэлгүүрт харах
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`${NEW_HREF}?copy=${e.id}`}>
                <Copy />
                Хуулах
              </Link>
            </DropdownMenuItem>
            {canStop && phase && (
              <DropdownMenuItem onSelect={() => onStop(phase)}>
                <Square />
                Зогсоох
              </DropdownMenuItem>
            )}
            {phase === "draft" && (
              <DropdownMenuItem
                onSelect={onRemove}
                className="text-destructive [&_svg]:text-destructive"
              >
                <Trash2 />
                Устгах
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
