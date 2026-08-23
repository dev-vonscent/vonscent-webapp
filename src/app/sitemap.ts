import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { SEED_PRODUCTS } from "@/features/products/seed";
import { BLOG_POSTS } from "@/features/blog/seed";

interface SlugRow {
  slug: string;
  updated_at: string | null;
}

async function productEntries(): Promise<SlugRow[]> {
  const supabase = createPublicClient();
  if (supabase) {
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_active", true);
    const rows = (data as SlugRow[] | null) ?? [];
    if (rows.length) return rows;
  }
  return SEED_PRODUCTS.map((p) => ({ slug: p.slug, updated_at: null }));
}

async function blogEntries(): Promise<SlugRow[]> {
  const supabase = createPublicClient();
  if (supabase) {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("is_published", true);
    const rows = (data as SlugRow[] | null) ?? [];
    if (rows.length) return rows;
  }
  return BLOG_POSTS.map((p) => ({ slug: p.slug, updated_at: p.date }));
}

async function collectionEntries(): Promise<SlugRow[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("collections")
    .select("slug, updated_at")
    .eq("type", "base")
    .eq("is_active", true);
  return (data as SlugRow[] | null) ?? [];
}

function entry(
  base: string,
  path: string,
  lastModified?: string | null,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${base}${path}`,
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const staticPaths = [
    "",
    "/catalog",
    "/collections",
    "/collections/build",
    "/about",
    "/contact",
    "/faq",
    "/blog",
  ];
  const [products, posts, collections] = await Promise.all([
    productEntries(),
    blogEntries(),
    collectionEntries(),
  ]);

  return [
    ...staticPaths.map((p) => entry(base, p)),
    ...products.map((r) => entry(base, `/products/${r.slug}`, r.updated_at)),
    ...collections.map((r) =>
      entry(base, `/collections/${r.slug}`, r.updated_at),
    ),
    ...posts.map((r) => entry(base, `/blog/${r.slug}`, r.updated_at)),
  ];
}
