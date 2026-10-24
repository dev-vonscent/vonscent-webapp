import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SideImage } from "@/components/shared/side-image";
import { QUIZ_QUESTIONS } from "@/features/quiz/questions";
import { ML_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Хүйсийн асуулт + бусад асуултууд (scent-quiz.tsx-тэй ижил тоо). */
const QUIZ_STEPS = 1 + QUIZ_QUESTIONS.length;

type IntentCard = {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  meta: string[];
  cta: string;
  href: string;
  image: string;
  /** Утсан дээрх хэвтээ тайралтад гол объектыг голд нь барина. */
  imagePosition: string;
};

const CARDS: IntentCard[] = [
  {
    index: "01",
    eyebrow: "Үнэрийн тест",
    title: "Үнэрээ ол",
    body: "Ямар үнэртэй ус сонгохоо мэдэхгүй байна уу? Хэдхэн асуултад хариулаад тохирох үнэртнүүдээ олоорой",
    meta: [`${QUIZ_STEPS} асуулт`, "30 секунд"],
    cta: "Эхлэх",
    href: "/quiz",
    image: "/quiz-side.webp",
    imagePosition: "object-[50%_40%]",
  },
  {
    index: "02",
    eyebrow: "Өөрийн багц",
    title: "Дуртай үнэртнүүдээ багцал",
    body: "4 ба түүнээс дээш үнэртэн сонгоод хямдралтай үнээр аваарай — өөрт таалагдсан хослолоо хүссэнээрээ бүрдүүл",
    meta: ["4+ үнэртэн", `${ML_SIZES[0]}–${ML_SIZES[ML_SIZES.length - 1]} мл`],
    cta: "Багц үүсгэх",
    href: "/collections/build",
    image: "/bundle-side.webp",
    imagePosition: "object-[50%_62%]",
  },
];

/**
 * Quiz ба багц үүсгэх — нүүрний хоёр «зам». Хоёр карт НЭГ бүтэцтэй (текст
 * зүүн, зураг баруун), тиймээс зэрэгцэхэд текстүүд нэг шугамаас эхэлж,
 * зургууд нэг хэмнэлээр давтагдана. Зураг нь картын дотор хүрээтэй
 * (inset) — gradient-ээр уусгахын оронд (design.md) цул ирмэгтэй. Зургийн
 * радиус = картын радиус − padding (p-2), булангууд концентрик байна.
 *
 * CTA нь саарал, hover дээр л цагаан болно — хуудсанд байнгын цагаан товч
 * ганц (hero) байх дүрэм (globals.css `--cta`).
 *
 * Карт бүхэлдээ дарагдана: CTA холбоосын `after:` давхарга картыг бүрхэнэ
 * (stretched link), тиймээс холбоосын нэр богино «Эхлэх» хэвээр, дотор нь
 * давхар интерактив элемент үүсэхгүй.
 *
 * Утсан дээр (`< md`) карт нягт мөр болно: жижиг дөрвөлжин зураг + гарчиг +
 * meta + сум. Тайлбар нуугдаж, CTA зөвхөн сум (нэр нь sr-only) — хоёр зам
 * нэг дэлгэцэд зэрэг харагдах ёстой.
 */
export function IntentCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CARDS.map((card) => (
        <IntentCardView key={card.href} card={card} />
      ))}
    </div>
  );
}

function IntentCardView({ card }: { card: IntentCard }) {
  const titleId = `intent-${card.index}-title`;
  return (
    <section
      aria-labelledby={titleId}
      className="force-black bg-card group relative grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-2xl p-2 md:grid-cols-1 md:grid-rows-[auto_1fr] md:items-stretch md:gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:grid-rows-1"
    >
      <SideImage
        src={card.image}
        sizes="(max-width: 767px) 96px, (max-width: 1024px) 50vw, 22vw"
        className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-2xl)-var(--spacing)*2)] md:aspect-video lg:order-2 lg:aspect-auto lg:min-h-80"
        imageClassName={cn(
          "object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 lg:object-center",
          card.imagePosition,
        )}
        fallbackClassName="bg-muted"
      />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1 pr-2 md:flex md:flex-col md:items-stretch md:gap-5 md:p-6 lg:order-1 lg:gap-8">
        <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.14em] whitespace-nowrap uppercase md:gap-3 md:tracking-[0.2em]">
          <span className="text-foreground tabular-nums">{card.index}</span>
          <span
            aria-hidden
            className="bg-field-edge hidden h-px w-6 md:block"
          />
          {card.eyebrow}
        </p>

        <div className="space-y-1.5 md:space-y-3 lg:my-auto">
          <h2
            id={titleId}
            className="text-lg/snug font-semibold tracking-tight text-balance wrap-break-word md:text-3xl/tight"
          >
            {card.title}
          </h2>
          <p className="text-muted-foreground hidden max-w-md text-pretty md:block">
            {card.body}
          </p>
          <ul className="flex flex-wrap gap-1.5 md:gap-2 md:pt-1">
            {card.meta.map((m) => (
              <li
                key={m}
                className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums md:px-3 md:py-1"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={card.href}
          className="bg-primary text-primary-foreground group-hover:bg-cta group-hover:text-cta-foreground max-md:text-foreground col-start-2 row-span-2 row-start-1 inline-flex size-8 items-center justify-center gap-2 rounded-full text-sm font-medium transition-[gap,background-color,color] duration-300 group-hover:gap-3 after:absolute after:inset-0 after:rounded-2xl motion-reduce:transition-none max-md:bg-transparent md:mt-auto md:h-11 md:w-fit md:justify-start md:px-5"
        >
          <span className="max-md:sr-only">{card.cta}</span>
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
