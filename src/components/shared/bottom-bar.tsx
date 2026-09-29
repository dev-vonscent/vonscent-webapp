"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useClaimBottomBar } from "@/components/shared/bottom-nav-store";

/**
 * Хуудасны наалдсан үйлдлийн зурвас («Захиалах», «Төлбөр төлөх») — утсан
 * дээр доод цэсний ОРОНД суух хөвөгч капсул (Glass Trio: /85 + blur + lift).
 *
 * Гурван зүйлийг нэг дор шийднэ, хуудас бүр өөрөө давтахгүй:
 *
 * • `document.body` руу portal. Хуудсууд `(shop)/template.tsx`-ийн
 *   `motion.div` (y: 8 → 0) дотор суудаг; transform-той өвөг нь `fixed`
 *   элементийн containing block болдог тул хуудас шилжих 250ms-д зурвас
 *   дэлгэцийн биш хуудасны ёроолд очиж «хальт» гараад алга болдог байв.
 * • Үргэлж mount, `show`-оор гулсаж орж гарна — доод цэстэй ижил 300ms
 *   `translate`, тиймээс цэс буух ба зурвас гарах нь нэг хөдөлгөөн болно.
 *   Өмнө нь зурвас гэнэт гарч, цэс 300ms гулсаж байх хооронд хоёулаа
 *   давхцан харагддаг байв.
 * • `bottom-visual` — iOS 26-ийн гар хаагдсаны дараах viewport-ийн алдааг
 *   залруулна (`VisualViewportSync`).
 */
export function BottomBar({
  show,
  hideFrom,
  children,
}: {
  show: boolean;
  /** Зурвас хэрэггүй болох breakpoint — хуудасны өөрийн CTA харагддаг өргөн. */
  hideFrom: "md" | "lg";
  children: React.ReactNode;
}) {
  useClaimBottomBar(show);

  // Portal-ын зорилт server дээр байхгүй; зурвас анх нуугдмал тул hydration
  // дараа mount хийх нь харагдах ялгаагүй.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      data-slot="bottom-bar"
      className={cn(
        "pb-safe bottom-visual pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-transform duration-300 ease-out motion-reduce:transition-none",
        hideFrom === "md" ? "md:hidden" : "lg:hidden",
        !show && "translate-y-[140%]",
      )}
      // Дэлгэцээс гарсан зурвас гарын товчлуураар ч, screen reader-т ч
      // бариулахгүй.
      inert={!show}
    >
      <div className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex w-full items-center gap-3 rounded-full py-2 pr-2 pl-4 backdrop-blur">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Элемент дэлгэцийн ДЭЭД ирмэгээс бүрэн өнгөрсөн эсэх — наалдсан зурвасын
 * «хуудасны CTA алга болсон» нөхцөл.
 *
 * `!isIntersecting` биш: CTA утсан дээр ихэвчлэн зургийн доор, дэлгэцийн
 * ДООР байдаг тул тэр нөхцөл хуудас нээгдэхэд зурвасыг шууд гаргаад,
 * хэрэглэгч CTA хүртэл гүйлгэмэгц дахин нуудаг байв — «хальт л гараад
 * алга болдог» зурвас. Худалдан авах зурвасын нийтлэг загвар (Baymard):
 * хэрэглэгч үндсэн товчийг ДАВЖ гүйлгэсний дараа л гарна.
 */
export function useScrolledPast(ref: React.RefObject<HTMLElement | null>) {
  const [past, setPast] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      const top = entry.rootBounds?.top ?? 0;
      setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= top);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}
