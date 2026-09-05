import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { getBlogPosts } from "@/features/blog/api";
import { BlogCoverThumb } from "@/features/blog/components/blog-cover";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Блог",
  description: "Үнэртний тухай гарын авлага, зөвлөмж, мэдээлэл.",
};

export default async function BlogPage() {
  const posts = await getBlogPosts();
  const [featured, ...rest] = posts;
  return (
    <div className="mx-auto max-w-352 px-4 py-12 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Блог</h1>
      <p className="text-muted-foreground mt-2">
        Үнэр сонгох гарын авлага, зөвлөмж, түүх.
      </p>

      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="group mt-10 grid gap-6 md:grid-cols-2"
        >
          <BlogCoverThumb
            post={featured}
            sizes="(max-width: 768px) 100vw, (max-width: 1408px) 50vw, 660px"
            className="rounded-xl border"
          />
          <div className="flex flex-col justify-center gap-3">
            <Badge variant="secondary" className="w-fit">
              {featured.category}
            </Badge>
            <h2 className="group-hover:text-gold-strong font-serif text-2xl font-semibold">
              {featured.title}
            </h2>
            <p className="text-muted-foreground">{featured.excerpt}</p>
            <span className="text-muted-foreground text-sm">
              {formatDate(featured.date)}
            </span>
          </div>
        </Link>
      )}

      <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
            <BlogCoverThumb
              post={post}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1408px) 33vw, 427px"
              className="rounded-lg border"
            />
            <div className="mt-3 space-y-1">
              <Badge variant="secondary" className="w-fit">
                {post.category}
              </Badge>
              <h3 className="group-hover:text-gold-strong font-serif text-lg font-medium">
                {post.title}
              </h3>
              <p className="text-muted-foreground text-sm">{post.excerpt}</p>
              <span className="text-muted-foreground text-xs">
                {formatDate(post.date)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
