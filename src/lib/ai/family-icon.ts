import "server-only";
import { randomUUID } from "node:crypto";
import { uploadImage } from "@/lib/storage/storage";
import { processImage, IMAGE_PRESETS } from "@/lib/storage/process-image";
import { generateProductImage } from "./generate-image";

/**
 * Үнэрийн төрлийн дүрс (`scent_families.icon_url`).
 *
 * Prompt-ийн эх сурвалж: `prompts/scent-families.md` — тэнд бичсэн дүрэм энд
 * кодоор давтагдана, тиймээс хоёрыг нь хамт шинэчилнэ.
 *
 * Субьектийг ЭНД шийдэхгүй: төрлийн нэрийг нь (монгол нэр + латин slug)
 * «үнэртэй усны үнэрийн төрөл» гэдгийг нь зааж өгөөд, ямар эд зурахыг загвар
 * өөрөө сонгоно. Тогтмол жагсаалттай байсан бол админ ямар ч нэр (жишээ нь
 * «Утаат», «Нарны») нэмэхэд жагсаалтад байхгүй тул юу ч гарахгүй байв.
 *
 * Нүүрний «Үнэрийн төрлөөр» хэсэг эдгээрийг 64px дотор `object-contain`-оор
 * харуулдаг ба хар/цагаан/ягаан гурван загварын аль ч дэвсгэр дээр буудаг.
 * Тиймээс дэвсгэр нь заавал ТУНГАЛАГ байх ёстой: OpenAI-аас PNG-ээр авч
 * (`background: "transparent"`), дараа нь alpha-гаа хадгалсан WebP болгоно.
 */
export function buildFamilyIconPrompt(slug: string, label: string): string {
  return `This picture is the icon of the "${label}" (latin slug: "${slug}") fragrance family — one of the scent families a perfume shop sorts its perfumes into. Decide for yourself what to show: pick the single real object that a perfume shopper would most immediately read as that family — normally the raw ingredient the family is named after, or the material most characteristic of it — and photograph that one object. Exactly one subject in the frame; if the natural choice is several small pieces of the same material, arrange them as one tight group.

Show it isolated as a clean product cut-out on a fully transparent background. Centered, filling about 80% of the square frame with even margins on all four sides. Photorealistic, natural vibrant color, fine visible surface texture, soft even studio lighting from the upper left, slight three-quarter view, and one subtle soft contact shadow directly beneath the object. Square 1:1 composition.`;
}

/**
 * Дүрсийг үүсгээд Storage-д хийж, нийтийн URL-ийг буцаана. Алдаа гарвал
 * `null` — дуудагч нь `after()` дотор ажилладаг тул алдаа шидэх нь зөвхөн
 * лог бохирдуулна, төрөл өөрөө дүрсгүйгээр амьд үлдэх нь зөв.
 */
export async function generateFamilyIcon(
  slug: string,
  label: string,
): Promise<string | null> {
  try {
    const { raw } = await generateProductImage({
      prompt: buildFamilyIconPrompt(slug, label),
      size: "1024x1024",
      quality: "high",
      background: "transparent",
    });
    // Дүрс 64px-д буудаг тул `icon` preset (256px) хангалттай; WebP нь
    // alpha-г хадгална.
    const image = await processImage(raw, IMAGE_PRESETS.icon);
    if (!image) return null;
    const uploaded = await uploadImage(
      `families/${slug}-${randomUUID()}.${image.ext}`,
      image.data,
      image.contentType,
    );
    return uploaded?.url ?? null;
  } catch {
    return null;
  }
}
