import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isImageGenConfigured } from "@/lib/env";
import { HERO_AI_LIMITS } from "@/lib/constants";
import { storagePath } from "@/lib/storage/storage";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getProductOptions } from "@/features/admin/api";
import type { ProductOption } from "@/features/admin/lib/product-option";
import { heroAdminGate } from "@/features/heroes/server";
import {
  HERO_AI_MAX_PRODUCTS,
  HERO_AI_SIZES,
  buildHeroPrompt,
  isHeroThemeKey,
} from "@/lib/ai/hero-prompt";
import { heroProductRefs, heroReferenceUrl } from "@/lib/ai/hero-references";
import { processHeroGeneration } from "@/lib/ai/process-hero-generation";

/** Зураг хариу буцсаны дараа (`after()`) үүснэ — 3584×1280 high ≈1–2 мин. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export interface HeroGenerationJob {
  id: string;
  target: "desktop" | "mobile";
  theme_key: string;
  /** Нэмэлт / «Өөрөө бичих» тайлбар — mobile хувилбар яг үүгээр үүснэ. */
  theme_extra: string;
  product_ids: string[];
  status: "pending" | "generating" | "done" | "failed";
  result_url: string | null;
  error: string | null;
  created_at: string;
}

const postSchema = z.object({
  groupId: z.string().uuid(),
  heroId: z.string().uuid().nullable().default(null),
  target: z.enum(["desktop", "mobile"]),
  theme: z.string().refine(isHeroThemeKey, { message: "Сэдэв буруу." }),
  extra: z.string().trim().max(HERO_AI_LIMITS.extraMax).default(""),
  quality: z.enum(["high", "fast"]).default("high"),
  /** Mobile: сонгосон desktop (PNG мастер эсвэл webp) — манай storage-оос л. */
  desktopRefUrl: z.string().url().nullable().default(null),
  /** Hero-д оруулах бараа (DB), сонгосон дарааллаар — ихдээ 3. */
  productIds: z
    .array(z.string().uuid())
    .max(HERO_AI_MAX_PRODUCTS, {
      message: `Ихдээ ${HERO_AI_MAX_PRODUCTS} үнэртэн сонгоно.`,
    })
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Нэг үнэртэн хоёр удаа сонгогдсон байна.",
    })
    .default([]),
});

/**
 * Hero-гийн зургийг AI-аар үүсгэх (plan §8.1). Prompt, reference-ийг сервер
 * бүрдүүлнэ (админ зөвхөн сэдэв + нэмэлт тайлбар). Хязгаар: hero-д зэрэг 2,
 * өдөрт 30 (plan §8.3). Туг (404) → staff (403) → key (503) → Zod.
 */
export async function POST(req: Request) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;
  if (!isImageGenConfigured) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY тохируулаагүй байна — AI зураг одоогоор боломжгүй." },
      { status: 503 },
    );
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Буруу хүсэлт." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.extra === "" && input.theme === "custom") {
    return NextResponse.json(
      { error: "«Өөрөө бичих» үед тайлбар оруулна уу." },
      { status: 400 },
    );
  }
  if (
    input.desktopRefUrl &&
    !storagePath(input.desktopRefUrl)?.startsWith("hero/")
  ) {
    return NextResponse.json({ error: "Лавлах зураг буруу." }, { status: 400 });
  }

  const { supabase } = gate;
  await expireStale(supabase);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: running }, { count: today }] = await Promise.all([
    supabase
      .from("hero_image_generations")
      .select("id", { count: "exact", head: true })
      .eq("group_id", input.groupId)
      .in("status", ["pending", "generating"]),
    supabase
      .from("hero_image_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);
  if ((running ?? 0) >= HERO_AI_LIMITS.concurrentPerHero) {
    return NextResponse.json(
      { error: `Зэрэг ${HERO_AI_LIMITS.concurrentPerHero} зураг үүсгэж байна — дуусахыг хүлээнэ үү.` },
      { status: 429 },
    );
  }
  if ((today ?? 0) >= HERO_AI_LIMITS.perDay) {
    return NextResponse.json(
      { error: `Өдрийн хязгаар (${HERO_AI_LIMITS.perDay} зураг) хүрсэн. Маргааш дахин оролдоно уу.` },
      { status: 429 },
    );
  }

  // Бараа сонгосон бол тэдний цэвэр зураг reference-ийн ЭХЭНД (image 1…N),
  // дараа нь scene: desktop → одоогийн hero; mobile → сонгосон desktop
  // (байхгүй бол одоогийн mobile hero). prompt энэ дараалалтай таарна.
  const productRefs = await heroProductRefs(supabase, input.productIds);
  if (!productRefs.ok) {
    return NextResponse.json(
      {
        error: `Зураггүй үнэртэн: ${productRefs.missing.join(", ")}. Барааны зураг эсвэл AI лавлах зураг оруулна уу.`,
      },
      { status: 400 },
    );
  }
  const products = productRefs.products;
  let references: string[];
  try {
    const productUrls = products.map((p) => p.url);
    references =
      input.target === "desktop"
        ? [...productUrls, await heroReferenceUrl("desktop")]
        : products.length
          ? [
              ...productUrls,
              input.desktopRefUrl ?? (await heroReferenceUrl("mobile")),
            ]
          : [
              await heroReferenceUrl("mobile"),
              ...(input.desktopRefUrl ? [input.desktopRefUrl] : []),
            ];
  } catch {
    return NextResponse.json(
      { error: "Лавлах зургийг бэлдэж чадсангүй." },
      { status: 500 },
    );
  }

  const prompt = buildHeroPrompt({
    target: input.target,
    theme: input.theme as Parameters<typeof buildHeroPrompt>[0]["theme"],
    extra: input.extra,
    withDesktopStyleRef: Boolean(input.desktopRefUrl),
    products: products.map((p) => ({ brand: p.brand, name: p.name })),
  });
  const { data: job, error } = await supabase
    .from("hero_image_generations")
    .insert({
      group_id: input.groupId,
      hero_id: input.heroId,
      target: input.target,
      theme_key: input.theme,
      theme_extra: input.extra,
      size: HERO_AI_SIZES[input.target][input.quality],
      prompt,
      reference_urls: references,
      product_ids: products.map((p) => p.id),
      created_by: gate.staff.id,
    })
    .select("id")
    .single();
  if (error || !job) {
    return NextResponse.json({ error: "Дараалалд оруулж чадсангүй." }, { status: 500 });
  }
  const jobId = (job as { id: string }).id;
  after(() => processHeroGeneration(jobId));
  return NextResponse.json({ jobId });
}

const getSchema = z.object({ groupId: z.string().uuid() });

/** Энэ hero-гийн оролдлогууд (шинэ нь эхэндээ) — маягт 4с тутам асууна. */
export async function GET(req: Request) {
  const gate = await heroAdminGate();
  if ("response" in gate) return gate.response;
  const parsed = getSchema.safeParse({
    groupId: new URL(req.url).searchParams.get("groupId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  await expireStale(gate.supabase);
  const { data } = await gate.supabase
    .from("hero_image_generations")
    .select(
      "id, target, theme_key, theme_extra, product_ids, status, result_url, error, created_at",
    )
    .eq("group_id", parsed.data.groupId)
    .order("created_at", { ascending: false })
    .limit(24);
  const jobs = (data ?? []) as HeroGenerationJob[];
  // Ажлуудын үнэртний нэр — картын шошго, маягтыг сүүлийн ажлаар бөглөхөд.
  const ids = [...new Set(jobs.flatMap((j) => j.product_ids ?? []))];
  const products: ProductOption[] = await getProductOptions({ ids });
  return NextResponse.json({
    jobs,
    products,
    configured: isImageGenConfigured,
  });
}

/**
 * `maxDuration`-д тасарсан ажил `generating` хэвээр үлдэж зэрэгцээний
 * хязгаарыг үүрд эзэлнэ — хуучирсныг амжилтгүй болгоно.
 */
async function expireStale(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
) {
  const cutoff = new Date(
    Date.now() - HERO_AI_LIMITS.staleMinutes * 60_000,
  ).toISOString();
  await supabase
    .from("hero_image_generations")
    .update({ status: "failed", error: "Хугацаа хэтэрсэн (timeout)." })
    .in("status", ["pending", "generating"])
    .lt("updated_at", cutoff);
}
