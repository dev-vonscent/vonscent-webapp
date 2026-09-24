"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

/**
 * «Захиалга хянах» холбоос — хэрэглэгчийн төлөвөөс хамаарч өөр газар заана.
 *
 * Нэвтэрсэн бол `/account/orders`, зочин бол `/order/find` (дугаар + утсаар
 * хайх). Урьд нь энэ холбоос үргэлж `/account/orders` руу заадаг байсан тул
 * зочин хүн нэвтрэх хуудсанд мөргөж, захиалгаа олох зам нь имэйл дэх линкээс
 * өөр байхгүй байв.
 *
 * Клиент талд шийдэгддэг шалтгаан: footer нь ISR-ээр кэшлэгддэг нүүр хуудсан
 * дээр л гардаг — серверт cookie уншвал бүх хуудас динамик болно
 * (`use-is-staff.ts`-тэй ижил шалтгаан). Шийдэгдэх хүртэл зочны зам руу
 * заана: аль ч хэрэглэгчид ажиллах бөгөөд нэвтэрсэн хүнийг ч төөрүүлэхгүй.
 */
export function OrderTrackLink({
  children = "Захиалга хянах",
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href">) {
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAuthed(Boolean(data.user));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href={authed ? "/account/orders" : "/order/find"} {...props}>
      {children}
    </Link>
  );
}
