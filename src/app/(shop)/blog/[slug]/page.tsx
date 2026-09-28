import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTENT_PAGES_HIDDEN } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { formatDate } from "@/lib/format";
import { getBlogPost, getRelatedPosts } from "@/features/blog/api";
import { JsonLd, articleJsonLd } from "@/components/shared/json-ld";
import { RichText } from "@/components/shared/rich-text";
import { BlogCoverHero } from "@/features/blog/components/blog-cover";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

// No prebuilt slugs — each page is generated on first visit, then served from
// the ISR cache. Without this, a dynamic segment renders on every request.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Нийтлэл олдсонгүй" };
  return {
    title: post.title,
    description: post.excerpt,
    // og:image comes from the sibling opengraph-image.tsx file convention.
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      url: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Хуудас түр нуугдсан — шууд URL-ээр ч орохгүй (CONTENT_PAGES_HIDDEN).
  if (CONTENT_PAGES_HIDDEN) notFound();

  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, 2);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <JsonLd data={articleJsonLd(post)} />
      <Breadcrumb aria-label="Замын мөр" className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/blog">Блог</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{post.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Badge variant="secondary">{post.category}</Badge>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {post.title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {formatDate(post.date)}
      </p>

      <BlogCoverHero post={post} />

      <RichText
        content={post.body}
        className="text-foreground/90 mt-8 text-[15px] leading-relaxed"
      />

      {related.length > 0 && (
        <div className="border-border mt-16 border-t pt-8">
          <h2 className="mb-4 font-serif text-xl font-semibold">
            Холбоотой нийтлэл
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="border-border hover:border-gold-strong rounded-lg border p-4 transition-colors"
              >
                <Badge variant="secondary">{p.category}</Badge>
                <h3 className="mt-2 font-serif font-medium">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
