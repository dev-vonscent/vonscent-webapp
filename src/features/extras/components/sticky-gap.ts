/**
 * Sticky мөрийн ДЭЭРХ завсрыг (`--header-offset`-ийн 4px, header нуугдахад
 * 8px) дэвсгэрээр хаана — эс бөгөөс доорх chip, үнэ тэр зурвасаар цухуйна.
 * Header-ээс доогуур z-тэй тул header-ийн шилэн гадаргууд нөлөөлөхгүй.
 * Sticky элемент нь өөрөө containing block (position: sticky).
 */
export const STICKY_GAP_COVER =
  "before:bg-background before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-2 before:content-['']";
