"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Admin-ий доторх сүүлийн хоёр URL (path + query). Модулийн түвшинд —
 * client навигацийн турш амьд, бүтэн reload-оор цэвэрлэгдэнэ (тэр үед
 * BackLink энгийн холбоос болж ажиллана).
 */
let currentUrl: string | null = null;
let previousUrl: string | null = null;

/** Admin layout-д нэг удаа — URL бүрийг тэмдэглэнэ. */
export function AdminNavTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    if (url === currentUrl) return;
    previousUrl = currentUrl;
    currentUrl = url;
  }, [pathname, search]);
  return null;
}

/**
 * Detail/засах хуудсуудын «← Жагсаалт» холбоос.
 *
 * Өмнө нь `href="/admin/orders"` руу шинэ навигаци хийдэг байсан тул
 * жагсаалтын шүүлт, хуудасны дугаар, гүйлгэлт бүгд алга болж, оператор
 * захиалга бүрийн дараа дээрээс нь дахин гүйлгэдэг байв (клиент, 2026-11).
 * Өмнөх хуудас нь яг тэр жагсаалт байвал түүх рүү буцна: URL (шүүлт)
 * хэвээр, гүйлгэлтийг `ScrollReset` сэргээнэ. Өөр газраас (хэрэглэгчийн
 * хуудас, шууд холбоос, reload) ирсэн бол `href` руу энгийн холбоос.
 */
export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const target = href.split("?")[0];

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Шинэ таб / цонхонд нээх нь браузерийнх хэвээр.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (previousUrl && previousUrl.split("?")[0] === target) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
