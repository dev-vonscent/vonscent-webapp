import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  { href: "/catalog", label: "Каталог", hint: "Бүх үнэртэн" },
  {
    href: "/collections",
    label: "Бэлэн багцууд",
    hint: "Хэд хэдэн үнэр нэг дор",
  },
  { href: "/quiz", label: "Үнэр сонгох тест", hint: "Өөрт тохирох үнэрээ ол" },
] as const;

/**
 * Сайтын ерөнхий 404.
 *
 * Дэлгүүрийн layout дотор (sticky header + утсан дээрх доод навигацын
 * `pb-24`) рендерлэгддэг тул `min-h-svh` өгвөл header-ийн өндрөөр хэтэрч
 * scroll үүсдэг байв. Өндрийг header (утсан дээр h-16, том дэлгэцэд
 * h-18 + h-11) болон доод зайг хасаж тооцно.
 */
export default function NotFound() {
  return (
    <section className="flex min-h-[calc(100svh-10.25rem)] flex-col items-center justify-center px-4 py-8 text-center md:min-h-[calc(100svh-7.5rem)] md:px-8">
      <p
        aria-hidden
        className="text-muted-foreground/25 text-[4.5rem] leading-none font-semibold tracking-tighter tabular-nums select-none md:text-[6rem]"
      >
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-balance md:text-3xl">
        Хуудас олдсонгүй
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm text-pretty md:text-base">
        Хаяг буруу эсвэл хуудас устсан байна.
      </p>

      <Button asChild size="lg" className="mt-7 w-full max-w-xs sm:w-auto">
        <Link href="/">Нүүр хуудас руу</Link>
      </Button>

      <nav
        aria-label="Санал болгох хуудсууд"
        className="mt-10 w-full max-w-2xl md:mt-12"
      >
        <ul className="grid gap-2 sm:grid-cols-3">
          {SUGGESTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="bg-secondary/60 hover:bg-secondary group flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors"
              >
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="text-muted-foreground block text-xs">
                    {s.hint}
                  </span>
                </span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
