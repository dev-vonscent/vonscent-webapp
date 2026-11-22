import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, ImageOff, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatEventPeriod } from "@/features/sale-events/lib";
import { SEASON_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  nowAndNext,
  seasonCards,
  specialHeroes,
  type SeasonCard,
} from "../board-model";
import { mdLong } from "../season";
import type { HeroAdminRow, HeroEventOption } from "../types";

/** 'YYYY-MM-DD' → «11-р сарын 22». */
function dayLong(day: string): string {
  return day.length >= 10 ? mdLong(day.slice(5, 10)) : "";
}

/** Одоогийн баннерыг хаана засах вэ (арга хэмжээнийх → студийн ④). */
function editHref(h: HeroAdminRow | null): string | null {
  if (!h) return null;
  if (h.season) return `/admin/heroes/season/${h.season}`;
  if (h.saleEventId) return `/admin/sale-events/${h.saleEventId}?step=banner`;
  return `/admin/heroes/${h.id}`;
}

/** Гол үйлдэл: хар theme-д `bg-primary` нь картаас ялгагдахгүй (CLAUDE.md). */
const CTA = "bg-cta text-cta-foreground hover:bg-cta/90";

function thumb(h: HeroAdminRow | null): string | null {
  return h?.desktopImage ? `${h.desktopImage.base}-1600.webp` : null;
}

function heroLabel(h: HeroAdminRow | null, events: readonly HeroEventOption[]): string {
  if (!h) return "Үндсэн баннер";
  if (h.season) return `${SEASON_LABEL[h.season]} — улирлын баннер`;
  if (h.saleEventId) {
    const e = events.find((x) => x.id === h.saleEventId);
    return `«${e?.name ?? h.name}» арга хэмжээний баннер`;
  }
  return `«${h.name}» баннер`;
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={cn("bg-secondary aspect-14/5 overflow-hidden rounded-md", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center gap-1.5 text-xs">
          <ImageOff className="size-4" aria-hidden />
          Зураг алга
        </div>
      )}
    </div>
  );
}

const STATE_TEXT: Record<SeasonCard["state"], string> = {
  live: "Одоо гарч байна",
  waiting: "",
  ready: "Бэлэн",
  incomplete: "Дутуу — өмнөх улирлын баннер үргэлжилнэ",
  empty: "Зураг алга — өмнөх улирлын баннер үргэлжилнэ",
};

/**
 * «Нүүрний баннер» самбар (studio-ux.md §7): одоо юу гарч байгаа, улирлын 4
 * карт, тусгай өдрийн баннер. Арга хэмжээний баннерыг энд засахгүй — «Одоо нүүр
 * хуудсанд» картаас студийн ④ руу очно (нэг баннерыг хоёр газраас засахгүй).
 * Жилийн хуваарийг клиентэд хэрэггүй тул хассан (2026-11-15).
 */
export function HeroBoard({
  heroes,
  events,
  now,
}: {
  heroes: HeroAdminRow[];
  events: HeroEventOption[];
  now: number;
}) {
  const { current, next } = nowAndNext(heroes, events, now);
  const cards = seasonCards(heroes, events, now);
  const specials = specialHeroes(heroes);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Нүүрний баннер"
        description="Арга хэмжээ, тусгай өдөр байхгүй үед улирлын баннер өөрөө ээлжилнэ. Арга хэмжээний баннерыг арга хэмжээний студид хийнэ."
      />

      <section className="space-y-3" aria-labelledby="hb-now">
        <h2 id="hb-now" className="font-serif text-lg font-semibold">
          Одоо нүүр хуудсанд
        </h2>
        <CurrentCard href={editHref(current)}>
          <Thumb src={thumb(current)} className="w-full shrink-0 sm:w-64" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{heroLabel(current, events)}</p>
            {current && <p className="text-muted-foreground text-sm">{current.title}</p>}
            {next && (
              <p className="text-muted-foreground text-sm text-pretty">
                Дараагийнх: {heroLabel(next.row, events)} — {dayLong(next.day)}-нд
              </p>
            )}
          </div>
        </CurrentCard>
      </section>

      <section className="space-y-3" aria-labelledby="hb-seasons">
        <h2 id="hb-seasons" className="font-serif text-lg font-semibold">
          Улирлын баннер
        </h2>
        <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <li key={c.season} className="bg-card flex flex-col gap-3 rounded-lg p-3">
              <Thumb src={thumb(c.row)} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{SEASON_LABEL[c.season]}</p>
                {c.state === "live" && <Badge variant="new">Одоо</Badge>}
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">
                Эхлэх өдөр: {mdLong(c.startMd)}
              </p>
              <p
                className={cn(
                  "text-sm text-pretty",
                  c.state === "incomplete" || c.state === "empty"
                    ? "text-muted-foreground"
                    : "",
                )}
              >
                {c.state === "waiting"
                  ? `«${c.over ?? "Өөр баннер"}» дуустал хүлээж байна`
                  : STATE_TEXT[c.state]}
              </p>
              {/* Зураг дутуу — гол үйлдэл (`CTA`). Бусад нь `secondary`: border
                  transparent тул `outline` нь энгийн текст шиг харагддаг байв. */}
              <Button
                asChild
                size="sm"
                variant="secondary"
                className={cn(
                  "mt-auto self-start",
                  (c.state === "empty" || c.state === "incomplete") && CTA,
                )}
              >
                <Link href={`/admin/heroes/season/${c.season}`}>
                  {c.state === "empty" ? "Зураг бэлдэх" : c.state === "incomplete" ? "Дуусгах" : "Засах"}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="hb-special">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="hb-special" className="font-serif text-lg font-semibold">
            Тусгай өдрийн баннер (хямдралгүй)
          </h2>
          {specials.length > 0 && <AddSpecial />}
        </div>
        {specials.length === 0 ? (
          <EmptyState
            surface="card"
            size="sm"
            icon={CalendarDays}
            title="Тусгай өдрийн баннер алга"
            description="Halloween, Шинэ жил г.м. — тодорхой хэдэн өдөр улирлын баннерын оронд гарна."
            action={<AddSpecial />}
          />
        ) : (
          <ul role="list" className="bg-card divide-border divide-y rounded-lg">
            {specials.map((h) => {
              const ended = h.endsAt != null && Date.parse(h.endsAt) <= now;
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="min-w-0 flex-1 font-medium">{h.name}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {h.startsAt && h.endsAt ? formatEventPeriod(h.startsAt, h.endsAt) : "Хугацаагүй"}
                  </span>
                  <Badge variant={ended ? "secondary" : h.isActive ? "new" : "outline"}>
                    {ended ? "Дууссан" : h.isActive ? "Нийтэлсэн" : "Ноорог"}
                  </Badge>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/admin/heroes/${h.id}`}>Засах</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-muted-foreground text-sm">
          Арга хэмжээний баннер →{" "}
          <Link href="/admin/sale-events" className="text-foreground inline-flex items-center gap-0.5 underline underline-offset-4">
            Арга хэмжээ
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      </section>
    </div>
  );
}

function AddSpecial() {
  return (
    <Button asChild size="sm" className={CTA}>
      <Link href="/admin/heroes/new">
        <Plus />
        Нэмэх
      </Link>
    </Button>
  );
}

/** «Одоо нүүр хуудсанд» карт — засах газар руу бүхэлдээ дарагдана. */
function CurrentCard({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = "bg-card flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center";
  if (!href) return <div className={cls}>{children}</div>;
  return (
    <Link href={href} className={cn(cls, "group hover:bg-accent")}>
      {children}
      <span className="text-muted-foreground group-hover:text-foreground inline-flex shrink-0 items-center gap-1 text-sm font-medium">
        Засах
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
