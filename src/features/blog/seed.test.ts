import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "./seed";

/**
 * Демо нийтлэлүүд гадны зурагт холбогдох ЁСГҮЙ (backlog I1).
 *
 * `getBlogPosts()` нь Supabase тохируулаагүй үед л биш, `blog_posts` хүснэгт
 * ХООСОН байхад ч энэ жагсаалт руу буцдаг (features/blog/api.ts). Тиймээс
 * энд stock зураг (өмнө нь `picsum.photos`) бичих нь «демо өгөгдөл» биш —
 * блог нийтлээгүй бодит дэлгүүрт харагдах зураг болно. Зураггүй бол
 * `blog-cover.tsx` загварын placeholder-оо харуулдаг тул алдагдах юм ч
 * байхгүй.
 */
describe("BLOG_POSTS seed", () => {
  it("гадны зургийн URL агуулахгүй", () => {
    const external = BLOG_POSTS.filter((p) => p.cover != null).map((p) => ({
      slug: p.slug,
      cover: p.cover,
    }));
    expect(external).toEqual([]);
  });

  it("placeholder зурахад хэрэгтэй талбарууд бүрэн", () => {
    // CoverPlaceholder нь гарчгийн эхний үсэг + ангилалаар зурагддаг.
    for (const post of BLOG_POSTS) {
      expect(post.title.trim().length).toBeGreaterThan(0);
      expect(post.category.trim().length).toBeGreaterThan(0);
    }
  });
});
