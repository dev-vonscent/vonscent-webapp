"use client";

import { usePathname } from "next/navigation";

/**
 * `/index` → `/`.
 *
 * Vercel дээр нүүр хуудсыг ISR-ээр дахин үүсгэхэд (background revalidate)
 * сервер нь замыг `/index` гэж хардаг (flight өгөгдөл `"c":["","index"]`).
 * Хөтөч дээр `usePathname()` нь `/` буцаадаг тул `isHome` зэрэг замаас
 * хамаарсан render сервер, клиент хоёрт зөрж React #418 (hydration mismatch)
 * өгч, бүх body-г клиент дээр дахин зурдаг байв. Локал `next build`-д
 * давтагддаггүй — зөвхөн prod-ийн revalidate хийсэн хуулбарт.
 */
export function normalizeRoutePathname(pathname: string): string {
  return pathname === "/index" ? "/" : pathname;
}

/** `usePathname()`-ийн оронд — layout-ын бүрэлдэхүүн (header, nav) нүүрэнд render болдог. */
export function useRoutePathname(): string {
  return normalizeRoutePathname(usePathname());
}
