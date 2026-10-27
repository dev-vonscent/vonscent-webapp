"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FieldError,
  fieldErrorProps,
  fieldErrorClass,
} from "@/components/ui/form-field";
import { useFeatureFlag } from "@/components/feature-flags";
import { ML_SIZES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { unpricedActiveSizes } from "@/lib/validators/product";
import { roundSalePrice } from "@/features/products/sale";
import { DatePicker } from "@/features/admin/components/date-picker";
import {
  dayEndIso,
  dayStartIso,
  isoEndToDay,
  isoToDay,
  ubToday,
} from "@/features/admin/lib/date-range";

export interface VariantDraft {
  ml: number;
  /** Үндсэн үнэ — хямдралгүй үед төлөх дүн, хямдралтай үед зураастай харагдана. */
  price: number;
  /**
   * Хямдарсан үнэ (0054). null / 0 бол хямдрал байхгүй. Байвал худалдан авагч
   * ЭНЭ дүнг төлнө — зөвхөн харагдац биш, сагс, захиалга, тайлан бүгд үүгээр
   * явна.
   */
  salePrice: number | null;
  /**
   * Хямдралын хугацаа (0166, ISO). null бол тэр талдаа хязгааргүй — хоёулаа
   * null = байнгын хямдрал. Дуусмагц үнэ өөрөө үндсэн үнэ рүүгээ буцна.
   */
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  active: boolean;
}

export { unpricedActiveSizes };

/** Хямдралгүй хэмжээний draft-ийн хямдралын талбарууд. */
export const EMPTY_SALE = {
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
} as const satisfies Partial<VariantDraft>;

/** Хугацааны төлөв — админ хадгалахаасаа өмнө нүдээр шалгана. */
function salePhase(v: VariantDraft): string | null {
  if (!v.salePrice || (!v.saleStartsAt && !v.saleEndsAt)) return null;
  const now = Date.now();
  if (v.saleStartsAt && new Date(v.saleStartsAt).getTime() > now)
    return "Эхлээгүй";
  if (v.saleEndsAt && new Date(v.saleEndsAt).getTime() <= now)
    return "Дууссан — энгийн үнээр зарагдаж байна";
  return "Хүчинтэй";
}

/**
 * A blank price row per size, for the create form.
 *
 * Every size — 2ml included — is an ordinary tier the shop sells (single
 * decants and bundles alike), so all four get a row. But they start **unticked**
 * and unpriced: rows used to arrive `active: true` at 0₮, so a product where the
 * admin only priced 5ml and 10ml published 2ml and 20ml for free. The operator
 * ticks a size once it has a price, rather than remembering to untick two.
 */
export function emptyVariants(): VariantDraft[] {
  return ML_SIZES.map((ml) => ({
    ml,
    price: 0,
    ...EMPTY_SALE,
    active: false,
  }));
}

/**
 * Per-size price entry (requirement.md A2). The admin types the price of each
 * decant size directly — there is no coefficient and no derived price, so what
 * is typed here is what the storefront charges.
 *
 * A ticked size with no price is the one error this table can produce, so it is
 * shown on the row itself; the form refuses to save until it is cleared, and
 * `variantDraftSchema` refuses it again on the server.
 */
export function VariantPriceTable({
  variants,
  onChange,
  /** Set once the operator has tried to save — errors stay quiet until then. */
  showErrors = false,
  idPrefix = "variant",
}: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  showErrors?: boolean;
  idPrefix?: string;
}) {
  // Хугацааны талбар зөвхөн `sale_page` туг асаалттай үед (0166).
  const periodOn = useFeatureFlag("sale_page");
  const unpriced = new Set(unpricedActiveSizes(variants));
  // Үндсэн үнээс өндөр «хямдрал» бол алдаа — DB-ийн check ч үүнийг татгалзана.
  const badSale = new Set(
    variants
      .filter((v) => v.salePrice != null && v.salePrice > v.price)
      .map((v) => v.ml),
  );
  const badPeriod = new Set(
    variants
      .filter(
        (v) =>
          v.saleStartsAt &&
          v.saleEndsAt &&
          new Date(v.saleEndsAt) <= new Date(v.saleStartsAt),
      )
      .map((v) => v.ml),
  );

  function update(ml: number, patch: Partial<VariantDraft>) {
    onChange(variants.map((v) => (v.ml === ml ? { ...v, ...patch } : v)));
  }

  return (
    <div className="space-y-2">
      <div className="bg-muted/20 overflow-x-auto rounded-lg">
        <table className="w-full min-w-[320px] text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Хэмжээ
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Үнэ (₮)
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Хямдарсан (₮)
              </th>
              {/* Not "1ml" — that collides with the monthly 1ml gift. This is
                  the unit price, shown so four hand-typed prices can be
                  compared at a glance. */}
              <th scope="col" className="px-3 py-2 font-medium">
                ₮ / 1мл
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Зарна
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const id = `${idPrefix}-${v.ml}`;
              const error =
                showErrors && unpriced.has(v.ml)
                  ? "Үнэ оруулна уу, эсвэл «Зарна»-г авна уу."
                  : undefined;
              const saleError =
                showErrors && badSale.has(v.ml)
                  ? "Үндсэн үнээс их байна."
                  : undefined;
              // ₮/1мл нь БОДИТООР төлөх үнээр бодогдоно — тэгэхгүй бол
              // хямдралтай хэмжээ хямд болсон нь энэ баганад харагдахгүй.
              const charged =
                v.salePrice && v.salePrice > 0 ? v.salePrice : v.price;
              const showPeriod = periodOn && Boolean(v.salePrice);
              const periodError = badPeriod.has(v.ml)
                ? "Дуусах хугацаа эхлэхээс хойш байх ёстой."
                : undefined;
              const phase = salePhase(v);
              return (
                <React.Fragment key={v.ml}>
                  <tr className="even:bg-muted/40">
                    <th
                      scope="row"
                      className="px-3 py-2 text-left text-base font-medium md:text-sm"
                    >
                      {v.ml}ml
                    </th>
                    <td className="px-3 py-2 align-top">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={100}
                        // 44px on a phone: a mistap between the 5ml and 10ml rows
                        // is a live pricing error, not a cosmetic one.
                        className={`h-11 w-28 md:h-8 md:w-32 ${fieldErrorClass(error)}`}
                        aria-label={`${v.ml}ml-ийн үнэ`}
                        value={v.price === 0 ? "" : v.price}
                        placeholder="0"
                        {...fieldErrorProps(id, error)}
                        onChange={(e) =>
                          update(v.ml, {
                            price: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                      <FieldError id={id} message={error} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={100}
                        className={`h-11 w-28 md:h-8 md:w-32 ${fieldErrorClass(saleError)}`}
                        aria-label={`${v.ml}ml-ийн хямдарсан үнэ`}
                        value={v.salePrice == null ? "" : v.salePrice}
                        placeholder="—"
                        {...fieldErrorProps(`${id}-sale`, saleError)}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          update(v.ml, {
                            // Хоосон талбар = хямдрал байхгүй (null). 0 гэсэн
                            // тоог «үнэгүй» гэж ойлгохгүйн тулд түүнийг ч мөн
                            // хямдралгүйд тооцно.
                            salePrice:
                              raw === "" ? null : Math.max(0, Number(raw) || 0),
                          });
                        }}
                        // Бичиж дуусмагц 100₮-д тоймлоно — бичих зуур
                        // тоймловол цифр бүрт тоо үсэрнэ. Сервер ч дахин
                        // тоймлоно (`variantSaleColumns`).
                        onBlur={() => {
                          if (v.salePrice)
                            update(v.ml, {
                              salePrice: roundSalePrice(v.salePrice, v.price),
                            });
                        }}
                      />
                      <FieldError id={`${id}-sale`} message={saleError} />
                    </td>
                    {/* Not a pricing input — just so the admin can eyeball whether
                      the four sizes are priced consistently. */}
                    <td className="text-muted-foreground px-3 py-2 align-top tabular-nums">
                      {charged > 0
                        ? formatPrice(Math.round(charged / v.ml))
                        : "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Checkbox
                        aria-label={`${v.ml}ml-ийг зарна`}
                        checked={v.active}
                        onCheckedChange={(c) =>
                          update(v.ml, { active: Boolean(c) })
                        }
                      />
                    </td>
                  </tr>
                  {showPeriod && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-52 space-y-1 text-xs">
                            <span className="text-muted-foreground block">
                              Хямдрал эхлэх
                            </span>
                            <DatePicker
                              aria-label={`${v.ml}ml-ийн хямдрал эхлэх`}
                              value={isoToDay(v.saleStartsAt)}
                              placeholder="Одооноос"
                              onChange={(day) =>
                                update(v.ml, { saleStartsAt: dayStartIso(day) })
                              }
                            />
                          </div>
                          <div className="w-52 space-y-1 text-xs">
                            <span className="text-muted-foreground block">
                              Хямдрал дуусах
                            </span>
                            <DatePicker
                              aria-label={`${v.ml}ml-ийн хямдрал дуусах`}
                              value={isoEndToDay(v.saleEndsAt)}
                              min={
                                isoToDay(v.saleStartsAt) > ubToday()
                                  ? isoToDay(v.saleStartsAt)
                                  : ubToday()
                              }
                              placeholder="Хугацаагүй"
                              {...fieldErrorProps(`${id}-period`, periodError)}
                              onChange={(day) =>
                                update(v.ml, { saleEndsAt: dayEndIso(day) })
                              }
                            />
                          </div>
                          <span className="text-muted-foreground pb-2 text-xs">
                            {phase ?? "Хоосон бол хугацаагүй"}
                          </span>
                        </div>
                        <FieldError id={`${id}-period`} message={periodError} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
