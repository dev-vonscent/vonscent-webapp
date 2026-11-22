import { redirect } from "next/navigation";
import { legacyExtrasHref } from "@/features/extras/lib/sections";

/**
 * «Нэмэлт бараа» нь «Үнэртний шил» (`/bottles`) ба «Дагалдах хэрэгсэл»
 * (`/accessories`) болж хуваагдсан (extras-shop-plan §19). Хуучин холбоос
 * (`?cat=…`) тохирох хуудас руу. Туг хаалттай бол тэр хуудас өөрөө 404.
 * Дэлгэрэнгүй `/extras/[slug]` хэвээр.
 */
export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(legacyExtrasHref(await searchParams));
}
