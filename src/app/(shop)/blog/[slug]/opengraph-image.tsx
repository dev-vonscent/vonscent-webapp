import { ogCard, OG_SIZE } from "@/lib/og";
import { getBlogPost } from "@/features/blog/api";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/constants";

export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SITE.name;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return ogCard({ title: SITE.tagline });

  return ogCard({
    kicker: post.category,
    title: post.title,
    subtitle: formatDate(post.date),
    imageUrl: post.cover,
  });
}
