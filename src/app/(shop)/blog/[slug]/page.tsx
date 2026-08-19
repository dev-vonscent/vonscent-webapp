import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { getBlogPost, getRelatedPosts } from "@/features/blog/api";

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
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, 2);

  return (
    <article className="mx-auto max-w-3xl px-4 md:px-8 py-12">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/blog" className="hover:text-foreground">
          Блог
        </Link>{" "}
        / <span className="text-foreground">{post.title}</span>
      </nav>

      <Badge variant="secondary">{post.category}</Badge>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {post.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDate(post.date)}
      </p>

      <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted">
        <Image
          src={post.cover}
          alt={post.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </div>

      <div className="prose mt-8 space-y-5 leading-relaxed">
        {post.body.map((p, i) => (
          <p key={i} className="text-[15px] text-foreground/90">
            {p}
          </p>
        ))}
      </div>

      {related.length > 0 && (
        <div className="mt-16 border-t border-border pt-8">
          <h2 className="mb-4 font-serif text-xl font-semibold">
            Холбоотой нийтлэл
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-lg border border-border p-4 transition-colors hover:border-primary"
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
