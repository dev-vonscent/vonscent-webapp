import Link from "next/link";
import { ArrowUpRight, ImageOff, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { formatEventPeriod } from "@/features/sale-events/lib";
import { SEASON_LABEL, type HeroSeason } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  nowAndNext,
  seasonCards,
  specialHeroes,
  yearStrip,
  type SeasonCard,
} from "../board-model";
import { mdLabel } from "../season";
import { monthDay } from "../default-copy";
import type { HeroAdminRow, HeroEventOption } from "../types";

const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

/** Улирлын зурвасын өнгө — theme token (gradient үгүй). */
const SEASON_TONE: Record<HeroSeason, string> = {
  spring: "bg-success/15",
  summer: "bg-warning/20",
  autumn: "bg-destructive/10",
  winter: "bg-primary/10",
};

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
 * карт, жилийн хуваарь, тусгай өдрийн баннер. Арга хэмжээний баннер энд зөвхөн
 * хуваарь дээр — засвар нь студийн ④ (нэг баннерыг хоёр газраас засахгүй).
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
  const year = Number(new Date(now + 8 * 3_600_000).toISOString().slice(0, 4));
  const strip = yearStrip(heroes, events, year, now);
  const specials = specialHeroes(heroes);
  const pct = (d: number) => `${(d / strip.days) * 100}%`;

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
        <div className="bg-card flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center">
          <Thumb src={thumb(current)} className="w-full shrink-0 sm:w-64" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{heroLabel(current, events)}</p>
            {current && <p className="text-muted-foreground text-sm">{current.title}</p>}
            {next && (
              <p className="text-muted-foreground text-sm text-pretty">
                Дараагийнх: {heroLabel(next.row, events)} — {monthDay(next.day)}-нд
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="hb-seasons">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hb-seasons" className="font-serif text-lg font-semibold">
            Улирлын баннер
          </h2>
          <p className="text-muted-foreground text-sm">Улирал эхлэхэд өөрөө солигдоно.</p>
        </div>
        <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <li key={c.season} className="bg-card flex flex-col gap-3 rounded-lg p-3">
              <Thumb src={thumb(c.row)} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{SEASON_LABEL[c.season]}</p>
                {c.state === "live" && <Badge variant="new">Одоо</Badge>}
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">{mdLabel(c.startMd)}-ээс</p>
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
              <Button
                asChild
                size="sm"
                variant={c.state === "empty" || c.state === "incomplete" ? "default" : "outline"}
                className="mt-auto self-start"
              >
                <Link href={`/admin/heroes/season/${c.season}`}>
                  {c.state === "empty" ? "Зураг бэлдэх" : "Засах"}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="hb-year">
        <h2 id="hb-year" className="font-serif text-lg font-semibold">
          Жилийн хуваарь {year}
        </h2>
        <div className="bg-card overflow-x-auto rounded-lg p-4">
          <div className="relative min-w-180 space-y-1.5">
            <div className="relative h-8">
              {strip.items.map((i) => {
                const body = (
                  <>
                    <span className="truncate">{i.label}</span>
                  </>
                );
                const cls = cn(
                  "absolute top-0 flex h-8 items-center overflow-hidden rounded-sm px-1.5 text-xs font-medium",
                  i.kind === "event"
                    ? "bg-cta text-cta-foreground"
                    : "bg-muted-foreground text-background",
                );
                const style = { left: pct(i.from), width: `max(${pct(i.to - i.from + 1)}, 0.5rem)` };
                const title = `${i.label} · ${i.kind === "event" ? "арга хэмжээ" : "тусгай өдөр"}`;
                return i.saleEventId ? (
                  <Link
                    key={i.id}
                    href={`/admin/sale-events/${i.saleEventId}?step=banner`}
                    className={cls}
                    style={style}
                    title={title}
                  >
                    {body}
                  </Link>
                ) : (
                  <Link key={i.id} href={`/admin/heroes/${i.id}`} className={cls} style={style} title={title}>
                    {body}
                  </Link>
                );
              })}
            </div>
            <div className="relative h-8">
              {strip.seasons.map((s) => (
                <div
                  key={s.from}
                  className={cn(
                    "absolute top-0 flex h-8 items-center overflow-hidden border-r border-background px-1.5 text-xs",
                    s.season ? SEASON_TONE[s.season] : "bg-secondary text-muted-foreground",
                  )}
                  style={{ left: pct(s.from), width: pct(s.to - s.from + 1) }}
                  title={s.season ? SEASON_LABEL[s.season] : "Үндсэн баннер"}
                >
                  <span className="truncate">{s.season ? SEASON_LABEL[s.season] : "Үндсэн"}</span>
                </div>
              ))}
            </div>
            <div className="text-muted-foreground relative h-4 text-[11px] tabular-nums">
              {MONTHS.map((m, i) => (
                <span
                  key={m}
                  className="absolute"
                  style={{ left: pct(Math.round((i * strip.days) / 12)) }}
                >
                  {m}-р сар
                </span>
              ))}
            </div>
            {strip.today !== null && (
              <span
                aria-hidden
                className="bg-foreground absolute top-0 h-17.5 w-0.5"
                style={{ left: pct(strip.today) }}
              />
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          Доор улирал, дээр нь арга хэмжээ (дарахад студи нээгдэнэ) ба тусгай өдрийн баннер — тэд
          улирлаас дээгүүр гарна. Босоо зураас — өнөөдөр.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="hb-special">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="hb-special" className="font-serif text-lg font-semibold">
            Тусгай өдрийн баннер (хямдралгүй)
          </h2>
          <Button asChild size="sm">
            <Link href="/admin/heroes/new">
              <Plus />
              Нэмэх
            </Link>
          </Button>
        </div>
        {specials.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-lg p-4 text-sm">
            Тусгай өдрийн баннер алга. Жишээ: Halloween, Шинэ жил — тодорхой хэдэн өдөр улирлын
            баннерын оронд гарна.
          </p>
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
                  <Button asChild size="sm" variant="ghost">
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
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      </section>
    </div>
  );
}
