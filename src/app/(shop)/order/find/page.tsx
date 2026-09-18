import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { OrderFindForm } from "@/features/order-lookup/components/order-find-form";

/**
 * `/order/find` — захиалгаа дугаараар нь хайх.
 *
 * Зорилтот хэрэглэгч: имэйлээ бичээгүй, эсвэл имэйлээ алдсан зочин. Үүнээс
 * өмнө төлбөрийн хуудсаа хаасан зочинд захиалга руугаа буцах ямар ч зам
 * байгаагүй — 30 минутын дараа чимээгүй цуцлагдана.
 *
 * Бүртгэлтэй хэрэглэгч `/account/orders`-оос шууд олно; энэ хуудас түүнийг
 * орлохгүй, зөвхөн нөхнө.
 */
export const metadata: Metadata = {
  title: "Захиалга хайх",
  description: "Захиалгын дугаар, утсаараа захиалгынхаа төлөвийг шалгаарай.",
};

export default async function OrderFindPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  // `?no=VS-1042` — имэйл доторх линк дугаарыг урьдчилж бөглөнө; утсаа л
  // бичихэд хангалттай болно.
  const { no } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12 md:px-8 md:py-20">
      <header className="space-y-2 text-center">
        <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
          Захиалга хянах
        </p>
        <h1 className="text-2xl font-semibold">Захиалгаа хайх</h1>
        <p className="text-muted-foreground text-sm">
          Захиалгын дугаар нь <span className="font-mono">VS-</span> үсгээр
          эхэлнэ — баталгаажуулах имэйл дотор байгаа.
        </p>
      </header>

      <Card>
        <CardContent className="p-5">
          <OrderFindForm initialOrderNo={no} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-sm">
        Бүртгэлтэй бол{" "}
        <Link href="/account/orders" className="text-gold-strong underline">
          Миний захиалга
        </Link>{" "}
        хэсгээс шууд харна. Асуух зүйл байвал{" "}
        <Link href="/contact" className="text-gold-strong underline">
          бидэнтэй холбогдоно уу
        </Link>
        .
      </p>
    </div>
  );
}
