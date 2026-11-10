import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { vialName } from "@/lib/vials";
import type {
  ReportExtraCategory,
  ReportFinance,
  ReportVial,
} from "../lib/report-finance";

/**
 * «Нэмэлт бараа» хэсэг (extras-shop-plan §18.6). Худалдан авалт нь авсан
 * өдрөөр бүтэн зарлага; үнэртэнтэй хамт гарсан сав орлого авчрахгүй, өртөг
 * нь авах үедээ аль хэдийн зарлага болсон. Зөрүү нь бэлэн мөнгөний (тухайн
 * хугацааны борлуулалт − худалдан авалт), нэг бүрчилсэн маржин биш.
 */
export function ReportExtras({
  finance,
  categories,
  vials,
  summary,
}: {
  finance: ReportFinance;
  categories: ReportExtraCategory[];
  /** Хоосон бол (туг хаалттай) савны хүснэгт гарахгүй. */
  vials: ReportVial[];
  summary: string;
}) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <PurchaseStat
          label="Үнэртэн (эх сав, нөхөлт)"
          value={finance.perfumePurchases}
        />
        <PurchaseStat label="Нэмэлт бараа" value={finance.extrasPurchases} />
        <PurchaseStat label="Сав (1–20ml)" value={finance.vialPurchases} />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-sm">
          <caption className="text-muted-foreground mb-2 text-left text-xs">
            Ангилал бүрээр — {summary}. Борлуулалт купоноос өмнө, худалдан авалт
            авсан өдрөөр.
          </caption>
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th scope="col" className="pb-2 font-medium">
                Ангилал
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Борлуулалт
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Худалдан авалт
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Зөрүү
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const diff = c.sales - c.purchases;
              return (
                <tr key={c.slug} className="even:bg-muted/40">
                  <th scope="row" className="py-2 text-left font-medium">
                    {c.name}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatPrice(c.sales)}
                    <span className="text-muted-foreground block text-xs">
                      {c.soldQty} ш
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatPrice(c.purchases)}
                    <span className="text-muted-foreground block text-xs">
                      {c.purchasedQty} ш
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-medium tabular-nums",
                      diff < 0 && "text-destructive",
                    )}
                  >
                    {formatPrice(diff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vials.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-sm">
            <caption className="text-muted-foreground mb-2 text-left text-xs">
              Сав — хэрэглээ мужид хүргэгдсэнээр, үлдэгдэл одоогийнх. Үнэртэн,
              бэлгийн дээжтэй гарсан сав орлогогүй — авсан үнэ нь зарлага.
            </caption>
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="pb-2 font-medium">
                  Сав
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Авсан
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Үнэртэнтэй
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Бэлгийн дээж
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Дангаар
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Үлдэгдэл
                </th>
              </tr>
            </thead>
            <tbody>
              {vials.map((v) => (
                <tr key={v.id} className="even:bg-muted/40">
                  <th scope="row" className="py-2 text-left font-medium">
                    {vialName(v)}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {v.purchasedQty}
                    {v.purchases > 0 && (
                      <span className="text-muted-foreground block text-xs">
                        {formatPrice(v.purchases)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {v.usedPerfume}
                  </td>
                  <td className="py-2 text-right tabular-nums">{v.usedGift}</td>
                  <td className="py-2 text-right tabular-nums">
                    {/* 1/2ml дангаар зарагдахгүй (§18.1 №2). */}
                    {v.ml <= 2 ? "—" : v.soldStandalone}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {v.onHand == null ? "Тоолоогүй" : v.onHand}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PurchaseStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/40 rounded-md px-3 py-2">
      <dt className="text-muted-foreground text-xs">
        Худалдан авалт · {label}
      </dt>
      <dd className="font-medium tabular-nums">{formatPrice(value)}</dd>
    </div>
  );
}
