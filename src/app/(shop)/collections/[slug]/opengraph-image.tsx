import { coverOgCard, fallbackOgCard, OG_SIZE } from "@/lib/og";
import { collectionOgData } from "@/lib/og-data";
import { SITE } from "@/lib/constants";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SITE.brandName;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await collectionOgData(slug);
  return data ? coverOgCard(data) : fallbackOgCard();
}
