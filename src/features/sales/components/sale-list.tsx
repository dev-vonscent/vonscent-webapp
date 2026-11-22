import Link from "next/link";
import { CalendarRange, Package, Percent, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/features/sale-events/components/phase-badge";
import { cn } from "@/lib/utils";
import { formatPcts, formatSalePeriod, type SaleSummary } from "../lib";

export const NEW_SALE_HREF = "/admin/sales/new";

/**
 * Админ → Маркетинг → Хямдрал — нэртэй хямдралуудын жагсаалт (16.3, туг
 * `named_sales`). Карт бүхэлдээ засах хуудас руу; үүсгэх нь тусдаа хуудсанд.
 * Хуучин нэргүй хямдрал нэг «Нэргүй» карт болно (16.6). Админ хуудас
 * force-dynamic тул төлөвийг сервер дээр бодсон (`summarizeSales`).
 */
export function SaleList({ rows }: { rows: SaleSummary[] }) {
  const create = (
    <Button asChild size="sm">
      <Link href={NEW_SALE_HREF}>
        <Plus className="size-4" />
        Шинэ хямдрал
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Хямдрал"
        // Доорх жагсаалттай таарна — дууссан, «Нэргүй» мөр ч тоологдоно.
        count={rows.length}
        description="Олон бараанд нэг дор хэмжээ бүрийн хувиар хугацаатай хямдрал. Бараа нэг зэрэг зөвхөн нэг дуусаагүй хямдралд орно. Нэрлэсэн арга хэмжээнд (Black Friday г.м. — каталогийн шүүлтүүр, зурвастай) «Арга хэмжээ»-г ашиглана уу."
        actions={rows.length > 0 && create}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Tag}
          surface="card"
          title="Хямдрал хараахан алга"
          description="Жишээ нь: «Март 8», 3/1–3/8, сонгосон үнэртний 5ml, 10ml-д 15%."
          action={create}
        />
      ) : (
        <ul role="list" className="space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <Card
                className={cn("relative", s.phase === "ended" && "bg-card/60")}
              >
                <CardContent className="space-y-1 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className={cn(
                        "font-serif text-lg font-semibold wrap-break-word",
                        s.unnamed && "text-muted-foreground italic",
                      )}
                    >
                      {/* Карт бүхэлдээ дарагдана. */}
                      <Link
                        href={`/admin/sales/${s.id}`}
                        className="after:absolute after:inset-0 after:rounded-[inherit]"
                      >
                        {s.name}
                      </Link>
                    </h2>
                    <PhaseBadge
                      phase={s.phase === "active" ? "live" : s.phase}
                    />
                  </div>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CalendarRange className="size-3.5" />
                      {formatSalePeriod(s.startsAt, s.endsAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Package className="size-3.5" />
                      {s.productCount} бараа
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Percent className="size-3.5" />
                      {formatPcts(s.pcts)}
                    </span>
                  </p>
                  {s.unnamed && (
                    <p className="text-muted-foreground text-xs">
                      Нэргүйгээр тавьсан хуучин хямдрал. Нээж нэр өгвөл нэг
                      нэртэй хямдрал болно.
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
