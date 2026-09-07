import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Loading shapes shared by the route-level `loading.tsx` files.
 *
 * A `loading.tsx` is a Suspense fallback Next swaps in the moment a navigation
 * starts, so it is the only thing the visitor sees while the server works. A
 * centred spinner tells them "something is happening"; a skeleton in the shape
 * of the page that is coming also tells them *what*, and — because it reserves
 * the same boxes — the real content drops in without the layout jumping.
 *
 * These live together rather than being copied into each route so the shapes
 * stay in step with the components they stand in for.
 */

/**
 * A visible skeleton block.
 *
 * The `Skeleton` primitive paints `bg-muted`, which on this app's default
 * black theme is #141414 on #000000 — an 8% step that disappears on any real
 * screen. Tinting with the *foreground* colour instead scales across all three
 * themes: light grey on white, near-black-plus on black, dusty rose on pink.
 *
 * Hierarchy between a heading bar and a body line comes from width, never from
 * lowering opacity — dimming a block that is already barely there just brings
 * back the invisible skeleton.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("bg-muted-foreground/18", className)} />;
}

/**
 * Spinner.
 *
 * An SVG stroke, never a `border` ring: globals.css collapses every border in
 * the app to transparent (`border-color: transparent !important`), so the
 * usual `border-2 border-t-foreground` trick renders as literally nothing.
 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-8 animate-spin", className)} />;
}

/** Full-height centred spinner — the fallback when a page has no clear shape. */
export function PageSpinner({ label = "Ачаалж байна" }: { label?: string }) {
  return (
    <div
      className="text-muted-foreground flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label={label}
    >
      <Spinner />
    </div>
  );
}

/** Title + subtitle block that most pages open with. */
export function HeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-64" />
    </div>
  );
}

/**
 * Product grid — mirrors `ProductGrid` (2 / 3 / 4 columns) and the card's
 * `aspect-4/5` image, so the cards land exactly where their skeletons were.
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col">
          <SkeletonBlock className="aspect-4/5 w-full rounded-2xl" />
          <div className="mt-3 flex flex-col gap-1.5">
            <SkeletonBlock className="h-2.5 w-16" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Rows of an admin list, inside the card the real table sits in. */
export function TableSkeleton({
  rows = 8,
  thumb = false,
}: {
  rows?: number;
  /** Leading square, for lists whose rows carry a picture. */
  thumb?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            {thumb && <SkeletonBlock className="size-12 shrink-0" />}
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The filter/sort strip above a catalogue listing. */
export function ToolbarSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonBlock key={i} className="h-11 w-40 md:h-9" />
      ))}
    </div>
  );
}

/**
 * The admin product form — image studio, then stacked field cards.
 *
 * Shared by `products/new` and `products/[id]/edit`, which render the same
 * layout; both otherwise inherit the products *table* skeleton from the
 * segment above them.
 */
export function ProductFormSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Маягт ачаалж байна">
      <SkeletonBlock className="h-6 w-40" />
      <SkeletonBlock className="h-56 w-full rounded-xl" />
      {[6, 4, 3].map((fields, card) => (
        <Card key={card}>
          <CardContent className="space-y-4 p-6">
            <SkeletonBlock className="h-6 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-24" />
                  <SkeletonBlock className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * An admin detail screen: back link, title row, then a wide panel beside a
 * narrow one. Stands in for the order and customer pages, which share that
 * shape and would otherwise inherit their list's table skeleton.
 */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <SkeletonBlock className="h-4 w-32" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-9 w-32 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card>
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonBlock className="size-12 shrink-0" />
                <SkeletonBlock className="h-4 flex-1" />
                <SkeletonBlock className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3.5 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A carousel rail: the section heading, then a row of cards at the widths
 * `ProductCarousel` uses (44% / 31% / 23.5%), so the real cards slide in
 * exactly where their placeholders sat.
 *
 * `heading` is off for a rail whose real title is already on screen — a
 * placeholder bar over a heading the visitor can read is a step backwards.
 */
export function CarouselSkeleton({
  cards = 4,
  heading = true,
  action = false,
}: {
  cards?: number;
  heading?: boolean;
  /** Reserve the "Бүгдийг үзэх" link on the right of the heading. */
  action?: boolean;
}) {
  return (
    <div role="status" aria-label="Ачаалж байна">
      {heading && (
        <div className="mb-6 flex items-end justify-between gap-4">
          <SkeletonBlock className="h-8 w-44" />
          {action && <SkeletonBlock className="h-4 w-28" />}
        </div>
      )}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="w-[44%] min-w-0 shrink-0 sm:w-[31%] lg:w-[23.5%]"
          >
            <SkeletonBlock className="aspect-4/5 w-full rounded-2xl" />
            <div className="mt-3 flex flex-col gap-1.5">
              <SkeletonBlock className="h-2.5 w-16" />
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A card whose imagery bleeds to one edge and whose copy sits beside it — the
 * shape `SideImage` panels use (the scent quiz, the build-your-own promo).
 * `imageRight` mirrors it for the quiz, whose artwork sits on the md+ right.
 */
export function PanelSkeleton({
  imageRight = false,
}: {
  imageRight?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card grid grid-cols-1 overflow-hidden rounded-2xl border",
        imageRight ? "md:grid-cols-[1fr_320px]" : "md:grid-cols-[320px_1fr]",
      )}
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock
        className={cn(
          "aspect-5/2 min-h-70 w-full rounded-none md:min-h-0",
          imageRight
            ? "md:order-2 md:aspect-auto"
            : "order-first md:aspect-auto",
        )}
      />
      <div
        className={cn(
          "flex min-w-0 flex-col justify-center gap-4 p-6 sm:p-10",
          imageRight && "md:order-1",
        )}
      >
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-4 w-full max-w-md" />
        <SkeletonBlock className="h-4 w-2/3 max-w-sm" />
        <SkeletonBlock className="mt-2 h-10 w-40 rounded-md" />
      </div>
    </div>
  );
}

/** Bundle cards — heading, then the `aspect-3/2` posters `CollectionCard` uses. */
export function CollectionGridSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Ачаалж байна">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <SkeletonBlock className="h-4 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <SkeletonBlock className="aspect-3/2 w-full rounded-2xl" />
            <div className="mt-3 flex flex-col gap-1.5">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The brand wall — two rows of `h-14` logo slots, matching `BrandMarquee`, so
 * the wall doesn't jump into place when the logos land.
 */
export function MarqueeSkeleton({ perRow = 6 }: { perRow?: number }) {
  return (
    <div role="status" aria-label="Ачаалж байна">
      <div className="mb-6 flex items-end justify-between gap-4">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-4 w-28" />
      </div>
      <div className="space-y-4 overflow-hidden">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-8">
            {Array.from({ length: perRow }).map((_, i) => (
              <SkeletonBlock
                key={i}
                className="h-10 w-32 shrink-0 sm:h-12 sm:w-40"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Review cards — quote lines over the author row. */
export function ReviewsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Ачаалж байна">
      <HeadingSkeleton className="mb-6" />
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-6"
          >
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
            <div className="mt-auto flex items-center gap-3 pt-4">
              <SkeletonBlock className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBlock className="h-3.5 w-24" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
              <SkeletonBlock className="size-15 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The home page: hero, the trust strip, then the first rail.
 *
 * Only what sits above the fold is drawn. The page itself streams — its shell
 * is static and every data-backed rail carries its own Suspense skeleton — so
 * this boundary is only ever on screen for the RSC round-trip, and filling the
 * whole document with placeholder rails would flash more than it explains.
 */
export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Нүүр хуудас ачаалж байна">
      <section className="bg-background relative -mt-18 w-full overflow-hidden">
        <div className="mx-auto grid max-w-352 items-center gap-8 px-4 pt-28 pb-16 md:grid-cols-2 md:px-8">
          <div className="max-w-xl space-y-6 max-md:mx-auto max-md:flex max-md:w-full max-md:flex-col max-md:items-center md:order-1">
            <SkeletonBlock className="h-3.5 w-44" />
            <SkeletonBlock className="h-12 w-full sm:h-16" />
            <SkeletonBlock className="h-12 w-4/5 sm:h-16" />
            <SkeletonBlock className="h-4 w-full" />
            <div className="flex gap-3">
              <SkeletonBlock className="h-11 w-36 rounded-md" />
              <SkeletonBlock className="h-11 w-36 rounded-md" />
            </div>
          </div>
          <div className="order-first mx-auto aspect-square w-full max-w-140 md:order-2">
            <SkeletonBlock className="size-full rounded-full" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-352 space-y-10 px-4 py-8 sm:space-y-16 sm:py-14 md:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card flex items-center gap-3 p-5">
              <SkeletonBlock className="size-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBlock className="h-3.5 w-24" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
        <CarouselSkeleton action />
      </div>
    </div>
  );
}

/** The scent-family tiles: icon over a label, six across on desktop. */
export function TileGridSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div role="status" aria-label="Ачаалж байна">
      <div className="mb-6">
        <SkeletonBlock className="h-8 w-44" />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: tiles }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex flex-col items-center gap-2 rounded-xl p-4"
          >
            <SkeletonBlock className="size-16 rounded-full" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Азын хүрд — title, the disc, then the spin button.
 *
 * Shared by the route boundary and by the page's own first render (the wheel
 * loads its state from `/api/lucky-wheel` after mount), so the two hand over
 * to each other without the disc changing size or moving.
 */
export function WheelSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6 px-4 py-10"
      role="status"
      aria-label="Азын хүрд ачаалж байна"
    >
      <SkeletonBlock className="mx-auto h-8 w-56" />
      <SkeletonBlock className="mx-auto aspect-square w-full max-w-[min(88vw,30rem)] rounded-full" />
      <SkeletonBlock className="mx-auto h-11 w-64 rounded-md" />
    </div>
  );
}

/**
 * A row of stat tiles — the number-first cards the reports and wheel screens
 * open with.
 */
export function StatRowSkeleton({
  tiles = 4,
  className = "grid grid-cols-2 gap-3 lg:grid-cols-4",
}: {
  tiles?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: tiles }).map((_, i) => (
        <SkeletonBlock key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Stacked setting cards — a title over a grid of labelled fields. Covers the
 * admin's form screens (тохиргоо, V point, контент…), which all share that
 * shape and would otherwise fall back to the section's bare spinner.
 */
export function SettingsSkeleton({
  cards = [4, 4],
  heading = true,
}: {
  /** Field count per card, one entry per card. */
  cards?: number[];
  heading?: boolean;
}) {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      {heading && <HeadingSkeleton />}
      {cards.map((fields, card) => (
        <Card key={card}>
          <CardContent className="space-y-4 p-6">
            <SkeletonBlock className="h-5 w-44" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-24" />
                  <SkeletonBlock className="h-10 w-full rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Heading over a list of rows inside one card — the taxonomy screens (брэнд,
 * үнэрийн төрөл, нэмэлт таг, бэлгийн сан), which are all "icon, name, actions"
 * lists followed by an add form.
 */
export function AdminListSkeleton({
  rows = 8,
  thumb = true,
  form = true,
}: {
  rows?: number;
  thumb?: boolean;
  /** Reserve the "add new" card under the list. */
  form?: boolean;
}) {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      <HeadingSkeleton />
      <TableSkeleton rows={rows} thumb={thumb} />
      {form && <SkeletonBlock className="h-44 w-full rounded-xl" />}
    </div>
  );
}
