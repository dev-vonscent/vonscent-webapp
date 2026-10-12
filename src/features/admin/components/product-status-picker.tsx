"use client";

import { PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  COMING_SOON_NOTE_MAX,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABEL,
  type ProductStatus,
} from "@/lib/constants";
import { canBeComingSoon } from "@/features/admin/lib/product-status";

/** Сонголт бүрийн нэг мөр тайлбар — админ юу болохыг товчноос нь уншина. */
const HINT: Record<ProductStatus, string> = {
  hidden: "Сайтад харагдахгүй",
  coming_soon: "Харагдана, захиалж болохгүй",
  active: "Сайтад зарагдана",
};

/**
 * Барааны төлөв (0125): Нуусан / Тун удахгүй / Идэвхтэй.
 *
 * «Идэвхтэй (нийтлэх)» checkbox-ийн орлох: гурав дахь төлөв нэмэгдсэн тул
 * хоёр утгатай контрол багтахаа больсон. Нэг удаа худалдаанд гарсан бараанд
 * «Тун удахгүй» идэвхгүй бөгөөд яагаад гэдгийг доор нь хэлнэ — DB ч мөн
 * хориглодог (ALREADY_LAUNCHED), энд зөвхөн админыг урьдчилан сэрэмжлүүлнэ.
 *
 * `launch` өгвөл (сан дээр «Тун удахгүй» байгаа бараа) «Идэвхтэй» хаагдаж,
 * оронд нь «Худалдаанд гаргах» товч гарна — гаргах цорын ганц зам нь launch
 * endpoint, PATCH нь `coming_soon → active`-ийг 409 болгодог.
 */
export function ProductStatusPicker({
  value,
  onChange,
  launchedAt = null,
  note,
  onNoteChange,
  launch,
}: {
  value: ProductStatus;
  onChange: (v: ProductStatus) => void;
  /** Байвал «Тун удахгүй» сонголт хаагдана. Шинэ бараанд null. */
  launchedAt?: string | null;
  /** «Тун удахгүй» үеийн ойролцоо хугацаа. */
  note: string;
  onNoteChange: (v: string) => void;
  /** Сан дээр «Тун удахгүй» бол — «Идэвхтэй»-н оронд гаргах товч. */
  launch?: { onLaunch: () => void; launching: boolean };
}) {
  const comingSoonLocked = !canBeComingSoon(launchedAt);
  const activeLocked = Boolean(launch);

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Барааны төлөв"
        className="grid grid-cols-3 gap-1.5"
      >
        {PRODUCT_STATUSES.map((s) => {
          const selected = s === value;
          const disabled =
            (s === "coming_soon" && comingSoonLocked) ||
            (s === "active" && activeLocked);
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(s)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md p-2 text-center text-sm/tight font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
                disabled &&
                  "hover:text-muted-foreground cursor-not-allowed opacity-50",
              )}
            >
              {PRODUCT_STATUS_LABEL[s]}
              <span
                className={cn(
                  "mt-0.5 hidden text-[11px] font-normal sm:block",
                  selected
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {HINT[s]}
              </span>
            </button>
          );
        })}
      </div>

      {comingSoonLocked && value !== "coming_soon" && (
        <p className="text-muted-foreground text-xs">
          Худалдаанд гарсан бараа «Тун удахгүй» болох боломжгүй. Дахин ирэхэд
          үлдэгдэл нэмэхэд л хангалттай.
        </p>
      )}

      {launch && (
        <div className="bg-secondary flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2">
          <p className="text-muted-foreground text-xs">
            «Тун удахгүй» барааг «Идэвхтэй» болгохдоо худалдаанд гаргана.
          </p>
          <LoadingButton
            type="button"
            size="sm"
            loading={launch.launching}
            onClick={launch.onLaunch}
          >
            <PackageCheck />
            Худалдаанд гаргах
          </LoadingButton>
        </div>
      )}

      {value === "coming_soon" && (
        <Field
          label="Хэзээ ирэх вэ (сонголтоор)"
          hint="Барааны хуудсанд харагдана. Тодорхой огноо биш, ойролцоо хугацаа бичвэл хоцорсон ч итгэл алдахгүй."
        >
          <Input
            value={note}
            maxLength={COMING_SOON_NOTE_MAX}
            placeholder="10-р сарын сүүлээр"
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
