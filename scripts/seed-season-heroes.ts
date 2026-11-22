/**
 * Улирлын баннерын анхны өгөгдөл (studio-ux.md D9, §8.2) — migration биш (CLAUDE.md).
 *
 *   pnpm db:seed-season-heroes-dev
 *
 * Одоо кодод байгаа зургийг (public/) storage руу хуулж улирлын мөр үүсгэнэ:
 * Өвөл = өвлийн зураг, Намар = үндсэн (v4) зураг. Хавар, Зун хоосон — админ
 * «Нүүрний баннер» хуудаснаас AI-аар эсвэл зураг оруулж бэлдэнэ; хоосон улирлыг
 * өмнөх нь нөхнө. Аль хэдийн байгаа улирлыг алгасна (дахин ажиллуулж болно).
 * `hero_admin` туг хаалттай бол эхэндээ зогсоно — storage-д ч юу ч оруулахгүй.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SEASON_HERO_STARTS, SEASON_LABEL, type HeroSeason } from "../src/lib/constants";
import { defaultSeasonCopy } from "../src/features/heroes/default-copy";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "product-images";
if (!url || !key) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY алга (--env-file).");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const SEEDS: {
  season: HeroSeason;
  desktop: string;
  mobile: string;
  alt: string;
}[] = [
  {
    season: "winter",
    desktop: "hero-desktop-winter",
    mobile: "hero-mobile-winter.webp",
    alt: "Өвлийн хяруутай дэвсгэр дээр Armani Stronger With You Intensely, Parfums de Marly Layton, Azzaro The Most Wanted болон decant савнууд",
  },
  {
    season: "autumn",
    desktop: "hero-desktop-v4",
    mobile: "hero-mobile-v4.webp",
    alt: "Armani Stronger With You Intensely, Parfums de Marly Layton, Azzaro The Most Wanted Parfum болон decant савнууд",
  },
];
const WIDTHS = [1600, 2400, 3200];

async function upload(local: string, dest: string): Promise<string> {
  const body = readFileSync(path.join(process.cwd(), "public", local));
  const { error } = await sb.storage
    .from(bucket)
    .upload(dest, body, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(`upload ${dest}: ${error.message}`);
  return sb.storage.from(bucket).getPublicUrl(dest).data.publicUrl;
}

async function main() {
  console.log(`→ ${new URL(url!).host}`);
  // Туг хаалттай санд (prod) storage-д ч юу ч хуримтлуулахгүй (CLAUDE.md).
  const { data: flag, error: flagErr } = await sb
    .from("feature_flags")
    .select("enabled")
    .eq("key", "hero_admin")
    .maybeSingle();
  if (flagErr) throw new Error(flagErr.message);
  if (!flag?.enabled) {
    console.log("• `hero_admin` туг хаалттай — юу ч хийсэнгүй.");
    return;
  }
  const { data: existing, error } = await sb
    .from("heroes")
    .select("season")
    .not("season", "is", null);
  if (error) throw new Error(error.message);
  const have = new Set((existing ?? []).map((r) => r.season as string));

  for (const s of SEEDS) {
    if (have.has(s.season)) {
      console.log(`• ${s.season}: аль хэдийн байна — алгаслаа`);
      continue;
    }
    const dir = `hero/season-${s.season}-seed`;
    const urls: string[] = [];
    for (const w of WIDTHS)
      urls.push(await upload(`${s.desktop}-${w}.webp`, `${dir}/desktop-${w}.webp`));
    const first = urls[0]!; // WIDTHS[0] = 1600
    const mobile = await upload(s.mobile, `${dir}/mobile.webp`);
    const copy = defaultSeasonCopy(s.season);
    const { error: e } = await sb.from("heroes").insert({
      name: `${SEASON_LABEL[s.season]} — улирлын баннер`,
      season: s.season,
      season_start_md: SEASON_HERO_STARTS[s.season],
      is_active: true,
      eyebrow: copy.eyebrow,
      title: copy.title,
      description: copy.description,
      mobile_description: copy.mobileDescription,
      primary_label: copy.primaryLabel,
      primary_target: copy.primaryTarget,
      secondary_label: copy.secondaryLabel,
      secondary_target: copy.secondaryTarget,
      desktop_image: {
        base: first.replace(/-1600\.webp$/u, ""),
        widths: WIDTHS,
        height1600: 571,
      },
      mobile_image: { src: mobile, width: 1600, height: 1200 },
      image_alt: s.alt,
      dark: false,
    });
    if (e) throw new Error(`${s.season}: ${e.message}`);
    console.log(`✓ ${s.season}: үүслээ (${SEASON_HERO_STARTS[s.season]}-ээс)`);
  }
  console.log("✅ Дууслаа. Хавар, Зуныг «Нүүрний баннер» хуудаснаас бэлдэнэ.");
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
