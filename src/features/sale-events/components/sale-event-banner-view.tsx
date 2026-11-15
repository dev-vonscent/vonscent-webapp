import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Каталогийн арга хэмжээний зурвасын ТӨРХ — hook, өгөгдөлгүй. Дэлгүүрийн
 * `SaleEventBanner` ба админы `CatalogPreview` (studio-ux.md §5.3) хоёулаа
 * үүгээр зурна: нэг класс, нэг бүтэц тул төрх зөрөхгүй.
 */
export function SaleEventBannerView({
  title,
  children,
  action,
}: {
  /** `<h2>` доторх агуулга. */
  title: React.ReactNode;
  /** Гарчгийн доорх мөрүүд (тайлбар, тоолуур, төлөвийн текст). */
  children?: React.ReactNode;
  /** Баруун дээд товч («Бүх каталог» / «Хаах»). */
  action?: React.ReactNode;
}) {
  return (
    <section
      aria-label="Урамшуулал"
      className="bg-secondary mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
    >
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-lg font-semibold tracking-tight wrap-break-word sm:text-xl">
          {title}
        </h2>
        {children}
      </div>
      {action}
    </section>
  );
}

/** Зурвасын тайлбарын мөрийн класс (live төлөв). */
export const SALE_EVENT_BANNER_DESCRIPTION =
  "text-muted-foreground text-sm wrap-break-word";

/** «🕐 Дуусахад 2 өдөр 4 цаг». `as="span"` — товчин дотор (админы харагдац). */
export function SaleEventCountdownLine({
  text,
  as: Tag = "p",
  className,
}: {
  text: string;
  as?: "p" | "span";
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "text-foreground flex items-center gap-1.5 text-sm font-medium tabular-nums",
        className,
      )}
    >
      <Clock className="size-4" aria-hidden />
      Дуусахад {text}
    </Tag>
  );
}
