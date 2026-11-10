"use client";

import Image from "next/image";
import Link from "next/link";
import { useFeatureFlag } from "@/components/feature-flags";
import { EXTRA_SECTION } from "@/features/extras/lib/sections";
import { cn } from "@/lib/utils";

interface TypeLink {
  href: string;
  title: string;
  /**
   * Нэг хэв маягтай тунгалаг дүрс (`public/type-*.webp`, 192px) — монохром
   * 3D, ирмэгийн гэрэлтэй тул цайвар, хар theme аль алинд тод. Хүйсний хар
   * цагаан фото картуудтай нэг гэр бүл. «Бэлгийн карт» (`type-gift-cards`)
   * тэр хуудас гарахад нэмэгдэнэ.
   */
  image: string;
}

/** Tailwind статик класс шаарддаг тул нүдний тоогоор. */
const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/**
 * Хүйсний товчлолын доорх «бусад төрлийн бараа» мөр — ЗӨВХӨН УТСАН ДЭЭР
 * (`HomeShortcuts`-ийн дотор). Хүйс нь үнэртний шүүлтүүр, харин багц, шил,
 * хэрэгсэл нь тусдаа төрөл тул нэг мөрөнд холихгүй — эс бөгөөс «Дагалдах
 * хэрэгсэл» хүйсний нэг сонголт мэт уншигдана. Утасны доод цэсэнд байр
 * байхгүй тул «Үнэртний шил», «Дагалдах хэрэгсэл»-ийг хэрэглэгч эндээс олно
 * (extras-shop-plan §19.1; Baymard: үндсэн ангиллын 30–40%-ийг нүүрэнд).
 *
 * Дүрс дээр, нэр доор (ангиллын мөр) — 4–5 нүд болсон ч багтана. Хоёроос
 * цөөн нүдтэй (туг хаалттай) бол мөр гарахгүй.
 * Намхан: «Эрэлттэй» эхний дэлгэцэд багтах ёстой (e2e home.spec.ts).
 */
export function HomeTypeLinks() {
  const extrasOn = useFeatureFlag("extras_shop");
  const links: TypeLink[] = [
    {
      href: "/collections",
      title: "Бэлэн багц",
      image: "/type-collections.webp",
    },
    ...(extrasOn
      ? [
          {
            href: EXTRA_SECTION.bottles.href,
            title: EXTRA_SECTION.bottles.title,
            image: "/type-bottles.webp",
          },
          {
            href: EXTRA_SECTION.accessories.href,
            title: EXTRA_SECTION.accessories.title,
            image: "/type-accessories.webp",
          },
        ]
      : []),
  ];

  // Туг хаалттай үед мөр бүхэлдээ нуугдана — prod өмнөхтэйгээ яг ижил
  // (main дээр энэ мөр байгаагүй). Ганц «Бэлэн багц» нүд үлдээхгүй.
  // Шинэ төрөл (бэлгийн карт г.м.) өөрийн тугтай нэмэгдэхэд нүд нэмэгдэнэ.
  if (links.length < 2) return null;

  return (
    <ul className={cn("mt-8 grid gap-2", COLS[links.length] ?? "grid-cols-4")}>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            // Дэвсгэргүй — тунгалаг дүрс хуудсан дээр шууд (хүйсний фото
            // картуудаас ялгарна). Дарах талбай нь padding-аар ≥44px.
            className="flex h-full flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center transition-opacity select-none [-webkit-touch-callout:none] active:opacity-60"
          >
            <span className="relative size-12 shrink-0">
              <Image
                src={l.image}
                alt=""
                fill
                sizes="48px"
                draggable={false}
                className="object-contain"
              />
            </span>
            <span className="min-w-0 text-xs/tight font-semibold text-balance">
              {l.title}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
