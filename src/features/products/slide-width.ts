/**
 * Слайдын өргөн. Утас, таблетад дараагийн карт ирмэгээс цухуйж гүйлгэж
 * болохыг хэлнэ; desktop-д сумтай тул яг багтана — 1280-аас 5, 1536-аас 6
 * карт (өргөн контейнер дээр 4 карт хэт томордог байв). `gap-4` = 1rem.
 * Өөрчилбөл `product-carousel.tsx`-ийн сумны `top`-ыг хамт солино.
 *
 * Тусдаа файлд: carousel нь "use client" тул тэндээс export хийсэн утгыг
 * server компонент (skeletons) импортлоход мөр биш client reference ирнэ.
 */
export const SLIDE_WIDTH =
  "w-[44%] min-w-0 shrink-0 sm:w-[31%] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)] 2xl:w-[calc((100%-5rem)/6)]";

/** Rail-ийн зам: бүх дэлгэц дээр нэг мөр. */
export const RAIL_TRACK = "flex gap-4";
