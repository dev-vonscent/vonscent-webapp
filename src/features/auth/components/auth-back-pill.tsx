"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Auth дэлгэцийн зүүн дээд буцах pill — маршрутаа дагаж өөрчлөгдөнө:
 * нууц код сэргээхэд нэвтрэх рүү, бусад үед дэлгүүр рүү буцаана.
 */
export function AuthBackPill() {
  const pathname = usePathname();
  const forgot = pathname.startsWith("/forgot-password");
  return (
    <Link
      href={forgot ? "/login" : "/"}
      className="glass text-muted-foreground hover:text-foreground shadow-soft absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all hover:-translate-x-0.5 sm:top-6 sm:left-6"
    >
      <ArrowLeft className="size-4" />
      {forgot ? "Нэвтрэх рүү буцах" : "Дэлгүүр рүү буцах"}
    </Link>
  );
}
