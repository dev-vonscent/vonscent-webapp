/**
 * Dev санд нэмэлт барааг бодит мэт болгоно — нэр, тайлбар, үнэ, нөөц, зураг.
 *
 *   pnpm db:seed-extras-dev
 *
 * Зураг нь Unsplash-ийн үнэгүй лицензтэй (арилжааны, attribution шаардахгүй)
 * бэлэн гэрэл зураг — CDN-ээс татаж WebP болгоод `extras/seed/<key>.webp`-д
 * upsert хийнэ, тиймээс дахин ажиллуулахад давхардахгүй. Шприцийн зургууд
 * (гурвуулаа + хэмжээ тус бүр) `scripts/assets/extras-seed/`-д. Грамын савны
 * зургийг админаас удирдана — script хөндөхгүй. Үлдэгдэлтэй / хоосон шил нь
 * эх үнэртнийхээ каталогийн зургийг ашиглана.
 *
 * Бүх бичилт админы `extras_save` / `extras_set_status` RPC-ээр — шинэ
 * хувилбарын нөөц худалдан авалт болж (0158) тайлантай зөрөхгүй, хуучин
 * хувилбарын нөөцийг хөндөхгүй. Prod руу заасан бол ажиллахгүй.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.dev).
 */
import * as fs from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

// Prod-оос хамгаална: .env.prod-ийн URL-тай таарвал зогсоно.
const prodUrl = fs.existsSync(".env.prod")
  ? fs
      .readFileSync(".env.prod", "utf8")
      .match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\n]+)/m)?.[1]
  : undefined;
if (prodUrl && prodUrl.replace(/\/+$/, "") === url.replace(/\/+$/, "")) {
  console.error(
    "Энэ script зөвхөн dev санд ажиллана (.env.prod руу заасан байна).",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

/** Unsplash-ийн зураг (images.unsplash.com/photo-<id>). */
const PHOTOS = {
  boxSmall: "1769805222413-9422a0027c68",
  boxLarge: "1671749999622-4087a86868cc",
  bagKraft: "1644015040594-8924d3ecc0dd",
  bagWhite: "1560254541-44a01f4ed006",
  pouchPink: "1642683497642-1463333fc318",
  pouchBrown: "1782787231448-7eea31c47449",
} as const;
type PhotoKey = keyof typeof PHOTOS;

/** Репод хадгалсан зураг — шприц: гурвуулаа хамт (картад) + хэмжээ тус бүр. */
const ASSETS = {
  syringeSet: "syringe-set.webp",
  syringe5: "syringe-5ml.webp",
  syringe10: "syringe-10ml.webp",
  syringe20: "syringe-20ml.webp",
} as const;
type AssetKey = keyof typeof ASSETS;

async function photo(k: PhotoKey): Promise<string> {
  const src = `https://images.unsplash.com/photo-${PHOTOS[k]}?fm=jpg&q=85&w=1200&h=1200&fit=crop&crop=entropy`;
  const res = await fetch(src, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${k}: татагдсангүй (${res.status})`);
  const webp = await sharp(Buffer.from(await res.arrayBuffer()))
    .webp({ quality: 82 })
    .toBuffer();
  return upload(k, webp);
}

async function asset(k: AssetKey): Promise<string> {
  return upload(k, fs.readFileSync(`scripts/assets/extras-seed/${ASSETS[k]}`));
}

async function upload(k: string, webp: Buffer): Promise<string> {
  const path = `extras/seed/${k}.webp`;
  const { error } = await sb.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`${k}: upload ${error.message}`);
  return `${url!.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function one<T>(
  q: PromiseLike<{ data: T; error: { message: string } | null }>,
  what: string,
): Promise<NonNullable<T>> {
  const { data, error } = await q;
  if (error || data == null) {
    throw new Error(`${what}: ${error?.message ?? "олдсонгүй"}`);
  }
  return data;
}

async function productImage(
  slug: string,
): Promise<{ id: string; url: string }> {
  const p = await one(
    sb.from("products").select("id").eq("slug", slug).single(),
    `product ${slug}`,
  );
  const img = await one(
    sb
      .from("product_images")
      .select("url")
      .eq("product_id", p.id)
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .single(),
    `product image ${slug}`,
  );
  return { id: p.id, url: img.url };
}

type Variant = { id: string; label: string; vial_id: string | null };

/**
 * Админаас нэр солиход slug шинэчлэгддэг («Декант шприц» → dekant-shprits) —
 * хэд хэдэн slug-аас эхэлж олдсоныг авна.
 */
async function extra(...slugs: string[]) {
  const row = await one(
    sb
      .from("extra_products")
      .select("id, slug, sort, images, extra_variants(id, label, vial_id)")
      .in("slug", slugs)
      .limit(1)
      .maybeSingle(),
    `extra ${slugs.join(" / ")}`,
  );
  return row as unknown as {
    id: string;
    slug: string;
    sort: number;
    images: string[];
    extra_variants: Variant[];
  };
}

/** Дахин ажиллуулахад шинэ бараа, хувилбар давхардахгүй — label-аар олно. */
async function existing(slug: string) {
  const { data } = await sb
    .from("extra_products")
    .select("id, extra_variants(id, label)")
    .eq("slug", slug)
    .maybeSingle();
  const row = data as { id: string; extra_variants: Variant[] } | null;
  return {
    id: row?.id ?? null,
    variant: (label: string) =>
      row?.extra_variants.find((v) => v.label === label)?.id ?? null,
  };
}

async function save(payload: Record<string, unknown>, by: string) {
  const res = await one(
    sb.rpc("extras_save", { p_payload: payload, p_by: by }),
    `extras_save ${payload.slug}`,
  );
  const { id } = res as { id: string };
  const status = await one(
    sb.rpc("extras_set_status", {
      p_extra: id,
      p_status: "published",
      p_by: by,
    }),
    `publish ${payload.slug}`,
  );
  const ok = (status as { ok: boolean; missing?: string[] }).ok;
  console.log(
    `${ok ? "✓" : "✗"} ${payload.slug}`,
    ok ? "" : JSON.stringify(status),
  );
}

const today = new Date().toISOString().slice(0, 10);
const buy = (qty: number, unit_cost: number) => ({
  qty,
  unit_cost,
  purchased_on: today,
});

async function main() {
  const by = (
    await one(
      sb
        .from("profiles")
        .select("id")
        .eq("role", "super_admin")
        .limit(1)
        .single(),
      "super_admin",
    )
  ).id as string;
  const cats = await one(
    sb.from("extra_categories").select("id, slug"),
    "categories",
  );
  const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;

  const img = Object.fromEntries(
    await Promise.all([
      ...(Object.keys(PHOTOS) as PhotoKey[]).map(async (k) => [
        k,
        await photo(k),
      ]),
      ...(Object.keys(ASSETS) as AssetKey[]).map(async (k) => [
        k,
        await asset(k),
      ]),
    ]),
  ) as Record<PhotoKey | AssetKey, string>;
  console.log("Зураг upload хийгдлээ:", Object.keys(img).length);

  // ── Шприц: 5/10/20ml, бусад нь идэвхгүй болно ─────────────────────
  const syringe = await extra("dekant-shprits", "shprits");
  const sv = (label: string) =>
    syringe.extra_variants.find((v) => v.label === label)!.id;
  await save(
    {
      id: syringe.id,
      slug: syringe.slug,
      name: "Декант шприц",
      description:
        "Зүүгүй, хошуундаа зориулалтын тунгалаг хушуутай шприц — хушууг грамын савны хүзүүнд углаад бүтэн шилнээс үнэртэнг дусал ч гоожуулалгүй шилжүүлнэ. Хуваарьтай тул хэдэн мл хийснээ яг харна. Үнэр холихгүйн тулд үнэртэн бүрт тусдаа шприц хэрэглээрэй.",
      // Эхнийх нь гурвуулаа — картад; хэмжээ сонгоход галерей шилжинэ.
      // Админаас зураг оруулсан бол түүнийг хэвээр үлдээнэ.
      images: syringe.images.length
        ? syringe.images
        : [img.syringeSet, img.syringe5, img.syringe10, img.syringe20],
      sort: 0,
      inventory_mode: "local_quantity",
      attrs: {},
      variants: [
        {
          id: sv("5ml"),
          label: "5ml",
          price: 1500,
          is_active: true,
          sort: 0,
          image_url: img.syringe5,
        },
        {
          id: sv("10ml"),
          label: "10ml",
          price: 2000,
          is_active: true,
          sort: 1,
          image_url: img.syringe10,
        },
        {
          id: sv("20ml"),
          label: "20ml",
          price: 2500,
          is_active: true,
          sort: 2,
          image_url: img.syringe20,
        },
      ],
    },
    by,
  );

  // ── Грамын сав: 9 сав бүгд (5/10/20ml × хар/ягаан/мөнгөлөг) ────────
  const vialExtra = await extra("gramin-sav", "gramyn-sav");
  const vials = await one(
    sb.from("vials").select("id, ml, style").in("ml", [5, 10, 20]),
    "vials",
  );
  const VIAL_PRICE: Record<number, number> = { 5: 1500, 10: 2000, 20: 2500 };
  await save(
    {
      id: vialExtra.id,
      slug: vialExtra.slug,
      name: "Грамын сав",
      description:
        "Декант цутгадаг металл гэртэй спрей сав — дотор нь шилэн колба, нарийн шүршигчтэй, таглаа нь цоргыг хамгаалж аялалд ч гоожихгүй. Цүнхэнд багтах хэмжээтэй тул дуртай үнэрээ хаана ч авч явна.",
      // Зураг, хувилбарын зураг админаас — хадгалсныг хэвээр үлдээнэ
      // (`image_url` түлхүүргүй бол SQL хөндөхгүй).
      images: vialExtra.images,
      sort: 0,
      inventory_mode: "shared_vial",
      attrs: {},
      variants: vials
        .sort(
          (a, b) =>
            a.ml - b.ml || String(a.style).localeCompare(String(b.style)),
        )
        .map((v, i) => ({
          id:
            vialExtra.extra_variants.find((x) => x.vial_id === v.id)?.id ??
            null,
          vial_id: v.id,
          price: VIAL_PRICE[v.ml],
          is_active: true,
          sort: i,
        })),
    },
    by,
  );

  // ── Бэлгийн хайрцаг: хувилбар бүр өөрийн зурагтай ─────────────────
  const box = await extra("belgiin-hairtsag");
  const bv = (label: string) =>
    box.extra_variants.find((v) => v.label === label)!.id;
  await save(
    {
      id: box.id,
      slug: "belgiin-hairtsag",
      name: "Бэлгийн хайрцаг",
      description:
        "Хатуу картон, гадуураа хар матт өнгөлгөөтэй, туузтай хайрцаг. Дотор нь савыг хөдөлгөөнгүй барих хөвөн дэвсгэртэй — бэлэглэхэд шууд бэлэн.",
      images: [img.boxSmall, img.boxLarge],
      sort: 0,
      inventory_mode: "local_quantity",
      attrs: {},
      variants: [
        {
          id: bv("Жижиг"),
          label: "Жижиг",
          price: 5000,
          is_active: true,
          sort: 0,
          image_url: img.boxSmall,
          size_note: "10ml-ийн 2 сав багтана",
        },
        {
          id: bv("Том"),
          label: "Том",
          price: 8000,
          is_active: true,
          sort: 1,
          image_url: img.boxLarge,
          size_note: "20ml-ийн 3 сав багтана",
        },
      ],
    },
    by,
  );

  // ── Шинэ: цаасан бэлгийн уут ──────────────────────────────────────
  const bag = await existing("tsaasan-belgiin-uut");
  await save(
    {
      id: bag.id,
      category_id: catId("gift-box"),
      slug: "tsaasan-belgiin-uut",
      name: "Цаасан бэлгийн уут",
      description:
        "Зузаан цаасан, бариултай бэлгийн уут. Савтай хайрцгийг ч, хэдэн грамын савыг ч эвтэйхэн багтаана. Нимгэн боодлын цаастай.",
      images: [img.bagKraft, img.bagWhite],
      sort: 10,
      inventory_mode: "local_quantity",
      attrs: {},
      variants: [
        {
          id: bag.variant("Крафт"),
          label: "Крафт",
          price: 2000,
          is_active: true,
          sort: 0,
          image_url: img.bagKraft,
          size_note: "Грамын сав эсвэл жижиг хайрцаг багтана",
          ...(bag.id ? {} : { initial_purchase: buy(40, 800) }),
        },
        {
          id: bag.variant("Цагаан"),
          label: "Цагаан",
          price: 2500,
          is_active: true,
          sort: 1,
          image_url: img.bagWhite,
          size_note: "Грамын сав эсвэл жижиг хайрцаг багтана",
          ...(bag.id ? {} : { initial_purchase: buy(30, 1000) }),
        },
      ],
    },
    by,
  );

  // ── Шинэ: даавуун уут ─────────────────────────────────────────────
  const pouch = await existing("daavuun-uut");
  await save(
    {
      id: pouch.id,
      category_id: catId("gift-box"),
      slug: "daavuun-uut",
      name: "Даавуун уут",
      description:
        "Зөөлөн даавуун уут — грамын савыг цүнхэнд зураас, цохилтоос хамгаална. Бэлэг болгон ч, өдөр тутамдаа ч хэрэглэхэд тохиромжтой.",
      images: [img.pouchPink, img.pouchBrown],
      sort: 20,
      inventory_mode: "local_quantity",
      attrs: {},
      variants: [
        {
          id: pouch.variant("Ягаан"),
          label: "Ягаан",
          price: 3500,
          is_active: true,
          sort: 0,
          image_url: img.pouchPink,
          size_note: "10ml хүртэлх 2 сав багтана",
          ...(pouch.id ? {} : { initial_purchase: buy(20, 1500) }),
        },
        {
          id: pouch.variant("Хүрэн"),
          label: "Хүрэн",
          price: 4500,
          is_active: true,
          sort: 1,
          image_url: img.pouchBrown,
          size_note: "20ml хүртэлх 2 сав багтана",
          ...(pouch.id ? {} : { initial_purchase: buy(15, 2200) }),
        },
      ],
    },
    by,
  );

  // ── Үлдэгдэлтэй шил, хоосон шил — эх үнэртний зураг ────────────────
  const versace = await productImage("versace-eau-fraiche");
  const leftover = await extra("uldegdeltei-shil-1");
  await save(
    {
      id: leftover.id,
      slug: "uldegdeltei-shil-1",
      name: "Versace Eau Fraiche",
      description:
        "Декант цутгаж байсан эх шил — дотор нь ойролцоогоор 10ml үлдсэн. Шил, таглаа бүрэн бүтэн.",
      images: [versace.url],
      sort: 0,
      inventory_mode: "leftover_liquid",
      attrs: {},
      leftover: { product_id: versace.id, remaining_ml: 10, full_ml: 100 },
      variants: [
        {
          id: leftover.extra_variants[0].id,
          price: 25000,
          is_active: true,
          sort: 0,
        },
      ],
    },
    by,
  );

  const sauvage = await productImage("dior-sauvage-edp");
  const dior = await extra("dior-sauvage-edp-hooson");
  await save(
    {
      id: dior.id,
      slug: "dior-sauvage-edp-hooson",
      name: "Dior Sauvage EDP",
      description:
        "Хоосон эх шил — цуглуулга, интерьерт. Гадна хайрцаггүй, шил бүрэн бүтэн.",
      images: [sauvage.url],
      sort: 0,
      inventory_mode: "local_quantity",
      attrs: { bottle_ml: 100 },
      product_id: sauvage.id,
      variants: dior.extra_variants.map((v, i) => ({
        id: v.id,
        label: v.label,
        price: 12000,
        is_active: true,
        sort: i,
      })),
    },
    by,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
