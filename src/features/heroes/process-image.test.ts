import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const uploads: string[] = [];
vi.mock("@/lib/storage/storage", () => ({
  uploadImage: vi.fn(async (path: string) => {
    uploads.push(path);
    return { path, url: `https://s/storage/v1/object/public/b/${path}` };
  }),
  publicUrl: (p: string) => `https://s/storage/v1/object/public/b/${p}`,
  storagePath: (u: string) => u.split("/public/b/")[1] ?? null,
}));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { processHeroImage } = await import("./server");

/** Тест зураг: зүүн тал нь `left` өнгө, баруун тал саарал. */
async function image(w: number, h: number, left: number) {
  const half = Math.round(w * 0.6);
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: half, height: h, channels: 3, background: { r: left, g: left, b: left } },
        }).png().toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}

describe("processHeroImage (plan §7.6, §8.2)", () => {
  beforeEach(() => {
    uploads.length = 0;
  });

  it("AI ажлаас бол замд ажлын id орно (generationIdOf)", async () => {
    const job = "0b5f3c1e-2a4d-4e8f-9c6b-1d2e3f4a5b6c";
    const r = await processHeroImage(await image(1536, 1152, 30), "mobile", "g", job);
    expect(r.ok && r.mobile?.src).toMatch(new RegExp(`/hero/g/gen-${job}-[0-9a-f]{8}-m\\d+\\.webp$`));
  });

  it("desktop 3584×1280 → 1600/2400/3200 webp, height1600 = 571", async () => {
    const r = await processHeroImage(await image(3584, 1280, 235), "desktop", "g1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.desktop?.widths).toEqual([1600, 2400, 3200]);
    expect(r.desktop?.height1600).toBe(571);
    expect(uploads.every((p) => p.startsWith("hero/g1/"))).toBe(true);
    expect(uploads.map((p) => p.match(/-(\d+)\.webp$/)?.[1])).toEqual([
      "1600",
      "2400",
      "3200",
    ]);
    // Цайвар хана → бараан текст.
    expect(r.suggestDark).toBe(false);
  });

  it("AI «хурдан» хэмжээнүүд ч орно (2688×960, 1536×1152)", async () => {
    expect((await processHeroImage(await image(2688, 960, 30), "desktop", "g")).ok).toBe(true);
    const m = await processHeroImage(await image(1536, 1152, 30), "mobile", "g");
    expect(m.ok && m.mobile?.width).toBe(1536);
  });

  it("бараан зүүн тал → dark санал", async () => {
    const r = await processHeroImage(await image(3584, 1280, 20), "desktop", "g");
    expect(r.ok && r.suggestDark).toBe(true);
  });

  it("буруу харьцаа / хэт жижиг → ойлгомжтой алдаа", async () => {
    const wrong = await processHeroImage(await image(3000, 1500, 200), "desktop", "g");
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.error).toContain("2.8:1");
    const small = await processHeroImage(await image(1792, 640, 200), "desktop", "g");
    expect(!small.ok && small.error).toContain("2400");
    const mob = await processHeroImage(await image(2000, 1000, 200), "mobile", "g");
    expect(!mob.ok && mob.error).toContain("4:3");
    expect(uploads).toEqual([]);
  });

  it("зураг биш байт → алдаа", async () => {
    const r = await processHeroImage(Buffer.from("not an image"), "desktop", "g");
    expect(r.ok).toBe(false);
  });
});
