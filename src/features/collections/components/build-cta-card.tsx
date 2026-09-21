import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * «Өөрөө угсрах» нь grid-ийн сүүлчийн нүд.
 *
 * Бэлэн багцуудыг уншиж дууссан хүн бол яг л тав дахь багцад юу хийхээ мэддэг
 * хүн — тиймээс энэ санал нь хуудасны толгойд байх «эндээс яв» товч биш,
 * жагсаалтын төгсгөлд тавигдсан дараагийн алхам.
 *
 * `h-full` нь grid-ийн мөрийн өндрийг дагана: багцын карт зураг + мэдээллийн
 * мөрөөсөө болж илүү өндөр учраас энд тогтмол харьцаа өгвөл мөр тэгширэхгүй.
 */
export function BuildCtaCard({
  minItems,
  discountPct,
}: {
  minItems: number;
  discountPct: number;
}) {
  return (
    <Link
      href="/collections/build"
      className="group bg-secondary hover:bg-accent flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center transition-colors active:scale-[0.99]"
    >
      <span className="bg-background/60 text-foreground flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-105">
        <Plus className="size-5" />
      </span>
      <span className="text-base/tight font-medium">Өөрөө угсрах</span>
      <span className="text-muted-foreground max-w-56 text-sm text-balance">
        Дуртай {minItems}+ үнэртнээ сонгоод {discountPct}% хямд
      </span>
    </Link>
  );
}
