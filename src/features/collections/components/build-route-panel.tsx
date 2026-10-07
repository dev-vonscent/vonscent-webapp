import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { BUNDLE_ML_SIZES } from "@/lib/constants";

/**
 * «Өөрөө үүсгэх» нь хуудасны толгойн доор, бэлэн багцуудын сүлжээнээс
 * өмнө бүтэн өргөнөөр зогсоно.
 *
 * Өмнө нь энэ санал grid-ийн сүүлчийн нүд байсан. Багц цөөхөн байхад тэр нь
 * ажилладаг ч, багц олон болмогц хоёр, гурван мөрийн доор орж, төгсгөл хүртэл
 * гүйлгэсэн хүнд л харагддаг — өөрөөр хэлбэл яг л бэлэн багцаасаа тохирохыг
 * нь олоогүй хүн энэ гарцыг хамгийн сүүлд мэдэж авдаг.
 *
 * Хоосон тасархай нүднүүд нь «та өөрөө дүүргэнэ» гэдгийг үггүйгээр хэлнэ;
 * тоо нь багцын доод хэмжээ (`minItems`). Тасархай хүрээг SVG-ээр зурна —
 * глобал дүрэм `border`-ыг бүгдийг нь ил тод болгодог (globals.css).
 * Товч нь `cta` token: хар темд цагаан, бусад темд тухайн темийн CTA —
 * `bg-secondary` дээр уусаж анзаарагдахгүй байна гэж клиент хэлсэн (2026-10).
 */
export function BuildRoutePanel({ minItems }: { minItems: number }) {
  const minMl = Math.min(...BUNDLE_ML_SIZES);
  const maxMl = Math.max(...BUNDLE_ML_SIZES);

  return (
    <Link
      href="/collections/build"
      className="group bg-card field-edge flex items-center gap-4 rounded-2xl p-4 sm:gap-5 sm:p-5"
    >
      <span aria-hidden className="hidden shrink-0 gap-1.5 sm:flex">
        {Array.from({ length: Math.min(minItems, 4) }, (_, i) => (
          <span
            key={i}
            className="text-muted-foreground group-hover:text-foreground relative flex size-10 items-center justify-center transition-colors"
          >
            <svg
              viewBox="0 0 40 40"
              fill="none"
              className="absolute inset-0 size-full"
            >
              <rect
                x="0.5"
                y="0.5"
                width="39"
                height="39"
                rx="8"
                stroke="currentColor"
                strokeOpacity="0.5"
                strokeDasharray="3 3"
              />
            </svg>
            <Plus className="size-3.5" />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-semibold sm:text-base">
          Өөрийн багцаа бүрдүүл
        </span>
        <span className="text-muted-foreground block text-xs text-pretty sm:text-sm">
          Дуртай {minItems}+ үнэртнээ сонгоод {minMl}–{maxMl}&nbsp;ml хэмжээг
          өөрөө тохируул
        </span>
      </span>
      <span className="bg-cta text-cta-foreground group-hover:bg-cta/90 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors">
        Эхлэх
        <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
