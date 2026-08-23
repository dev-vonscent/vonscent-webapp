import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { BlogPostRow } from "@/db/types";
import { BLOG_POSTS, type BlogPost } from "./seed";

/**
 * Blog data access. Reads published posts from `blog_posts`; falls back to the
 * seed list when Supabase isn't configured (demo) or the table is empty.
 */

function mapRow(r: BlogPostRow): BlogPost {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    category: r.category,
    date: r.published_at,
    cover: r.cover_url ?? `https://picsum.photos/seed/${r.slug}/1200/630`,
    body: r.body ?? "",
  };
}

export const getBlogPosts = cache(async (): Promise<BlogPost[]> => {
  if (!isSupabaseConfigured) return BLOG_POSTS;
  const supabase = createPublicClient();
  if (!supabase) return BLOG_POSTS;
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  const rows = (data as BlogPostRow[] | null) ?? [];
  if (rows.length === 0) return BLOG_POSTS;
  return rows.map(mapRow);
});

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const all = await getBlogPosts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getRelatedPosts(
  slug: string,
  limit = 2,
): Promise<BlogPost[]> {
  const all = await getBlogPosts();
  return all.filter((p) => p.slug !== slug).slice(0, limit);
}
