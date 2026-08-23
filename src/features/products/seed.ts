import { ML_SIZES } from "@/lib/constants";
import type { ProductDetail } from "@/lib/types";
import type {
  Concentration,
  Gender,
  ScentFamily,
  Season,
  TagKind,
} from "@/db/types";

/**
 * Seed catalogue used by the demo when Supabase is not configured, and by the
 * DB seed script.
 */
interface SeedInput {
  slug: string;
  name: string;
  brand: string;
  gender: Gender;
  concentration: Concentration;
  /** One scent can belong to several families (e.g. дорнын + модлог). */
  scentFamilies: ScentFamily[];
  seasons?: Season[];
  originCountry: string;
  releaseYear: number;
  bottlePrice: number; // ₮
  bottleMl: number;
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  description: string;
  /** Optional extra description parts (0022); demo rows may omit them. */
  notesDescription?: string;
  usageDescription?: string;
  shortDescription?: string;
  tags: TagKind[];
  onHandMl: number;
  ratingAvg: number;
  ratingCount: number;
  /**
   * Demo shelf price per ml size. Production prices are typed in the admin
   * form, so these are plain fixture numbers — nothing derives them. A size
   * left out of the map is simply not offered on that demo product.
   */
  prices?: Partial<Record<(typeof ML_SIZES)[number], number>>;
}

const RAW: SeedInput[] = [
  {
    slug: "dior-sauvage-edp",
    name: "Sauvage",
    brand: "Dior",
    gender: "male",
    concentration: "EDP",
    scentFamilies: ["fresh"],
    originCountry: "Франц",
    releaseYear: 2018,
    bottlePrice: 480000,
    bottleMl: 100,
    prices: { 5: 38400, 10: 64900, 20: 110400 },
    notesTop: ["Бергамот", "Чинжүү"],
    notesHeart: ["Сычуань чинжүү", "Лаванда", "Гэрийн заамар"],
    notesBase: ["Амбра", "Кедр", "Лабданум"],
    description:
      "Цөл шиг тунгалаг, шинэхэн нэгэн агшин. Бергамотын гэрэлт эхлэл амброксын дулаан сүүлээр төгсдөг — өдөр тутамд тохирох, эрхэмсэг сонголт.",
    tags: ["hot"],
    onHandMl: 60,
    ratingAvg: 4.7,
    ratingCount: 128,
  },
  {
    slug: "chanel-coco-mademoiselle",
    name: "Coco Mademoiselle",
    brand: "Chanel",
    gender: "female",
    concentration: "EDP",
    scentFamilies: ["floral"],
    originCountry: "Франц",
    releaseYear: 2001,
    bottlePrice: 620000,
    bottleMl: 100,
    prices: { 5: 49600, 10: 83700, 20: 142600 },
    notesTop: ["Жүрж", "Бергамот"],
    notesHeart: ["Сарнай", "Жасмин", "Личи"],
    notesBase: ["Пачули", "Ваниль", "Вэтивер"],
    description:
      "Зоригтой, эмэгтэйлэг сонгодог. Цитрусын тод эхлэл сарнай-жасмины зүрхээр дамжин пачулийн гүн ул мөр үлдээнэ.",
    tags: ["hot", "new"],
    onHandMl: 45,
    ratingAvg: 4.8,
    ratingCount: 96,
  },
  {
    slug: "tom-ford-oud-wood",
    name: "Oud Wood",
    brand: "Tom Ford",
    gender: "unisex",
    concentration: "EDP",
    scentFamilies: ["woody"],
    originCountry: "АНУ",
    releaseYear: 2007,
    bottlePrice: 1150000,
    bottleMl: 100,
    prices: { 5: 78000, 10: 155300, 20: 264500 },
    notesTop: ["Зүүн модны од", "Розвуд", "Кардамон"],
    notesHeart: ["Сандал", "Палисандр", "Од"],
    notesBase: ["Тонка", "Ваниль", "Амбра"],
    description:
      "Ховор зүүн модны од (oud)-ыг зөөлрүүлсэн чамин найрлага. Утаат, дулаахан, нэр төртэй — унисекс шилдэг сонголт.",
    tags: ["hot"],
    onHandMl: 30,
    ratingAvg: 4.9,
    ratingCount: 64,
  },
  {
    slug: "creed-aventus",
    name: "Aventus",
    brand: "Creed",
    gender: "male",
    concentration: "EDP",
    scentFamilies: ["fresh"],
    originCountry: "Их Британи",
    releaseYear: 2010,
    bottlePrice: 1450000,
    bottleMl: 100,
    prices: { 5: 116000, 10: 195800, 20: 333500 },
    notesTop: ["Хан боргоцой", "Алимны навч", "Бергамот"],
    notesHeart: ["Хус мод", "Пачули", "Сарнай"],
    notesBase: ["Заамар", "Хувь", "Ваниль"],
    description:
      "Хүч ба эрхэмсэг байдлын домог. Утаат хус, шүүслэг хан боргоцой — амжилтын үнэр хэмээн нэрлэгддэг.",
    tags: ["hot"],
    onHandMl: 25,
    ratingAvg: 4.9,
    ratingCount: 210,
  },
  {
    slug: "ysl-libre-edp",
    name: "Libre",
    brand: "Yves Saint Laurent",
    gender: "female",
    concentration: "EDP",
    scentFamilies: ["floral"],
    originCountry: "Франц",
    releaseYear: 2019,
    bottlePrice: 540000,
    bottleMl: 90,
    prices: { 5: 48000, 10: 81000, 20: 138000 },
    notesTop: ["Мандарин", "Лаванда", "Үхрийн нүд"],
    notesHeart: ["Лаванда", "Жасмин", "Цэцэгт гэрийн заамар"],
    notesBase: ["Ваниль", "Кедр", "Амбра"],
    description:
      "Эрх чөлөөний илэрхийлэл — Францын лаванда, Марокын улбар цэцгийн зоримог нийлэмж.",
    tags: ["new"],
    onHandMl: 50,
    ratingAvg: 4.6,
    ratingCount: 73,
  },
  {
    slug: "maison-margiela-by-the-fireplace",
    name: "By the Fireplace",
    brand: "Maison Margiela",
    gender: "unisex",
    concentration: "EDT",
    scentFamilies: ["spicy"],
    originCountry: "Франц",
    releaseYear: 2015,
    bottlePrice: 430000,
    bottleMl: 100,
    prices: { 5: 34400, 10: 58100, 20: 98900 },
    notesTop: ["Гваякийн мод", "Цурампи", "Улаан чинжүү"],
    notesHeart: ["Тооно шарсан үнэр", "Гэрийн заамар"],
    notesBase: ["Ваниль", "Кедр", "Шатсан модны утаа"],
    description:
      "Өвлийн задгай зуухны дэргэдэх дулаан агшин. Утаат, чихэрлэг, тайвшруулах гэрийн мэдрэмж.",
    tags: ["sale"],
    onHandMl: 18,
    ratingAvg: 4.5,
    ratingCount: 41,
  },
  {
    slug: "acqua-di-parma-colonia",
    name: "Colonia",
    brand: "Acqua di Parma",
    gender: "unisex",
    concentration: "EDC",
    scentFamilies: ["citrus"],
    originCountry: "Итали",
    releaseYear: 1916,
    bottlePrice: 510000,
    bottleMl: 100,
    prices: { 5: 40800, 10: 68900, 20: 117300 },
    notesTop: ["Сицилийн нимбэг", "Бергамот", "Жүрж"],
    notesHeart: ["Лаванда", "Розмарин", "Вербена"],
    notesBase: ["Вэтивер", "Сандал", "Заамар"],
    description:
      "Италийн сонгодог одеколон. Цитрусын цэвэр, сэргэг эхлэл — цаг хугацааг дассан эрхэмсэг энгийн байдал.",
    tags: [],
    onHandMl: 8,
    ratingAvg: 4.4,
    ratingCount: 33,
  },
  {
    slug: "jo-malone-wood-sage-sea-salt",
    name: "Wood Sage & Sea Salt",
    brand: "Jo Malone",
    gender: "unisex",
    concentration: "EDC",
    scentFamilies: ["fresh"],
    originCountry: "Их Британи",
    releaseYear: 2014,
    bottlePrice: 460000,
    bottleMl: 100,
    prices: { 5: 36800, 10: 62200, 20: 105800 },
    notesTop: ["Далайн давс", "Шүүслэг улаан анар"],
    notesHeart: ["Шавар", "Гэрийн заамар"],
    notesBase: ["Шарилж", "Замаг", "Цагаан мод"],
    description:
      "Эрэг дагуух салхи. Давслаг, ургамалт, цайвар — задгай агаарын чөлөөт мэдрэмж.",
    tags: ["new", "sale"],
    onHandMl: 38,
    ratingAvg: 4.5,
    ratingCount: 57,
  },
];

function buildVariants(input: SeedInput) {
  return ML_SIZES.filter((ml) => input.prices?.[ml] != null).map((ml) => ({
    id: `${input.slug}-${ml}`,
    ml,
    price: input.prices![ml]!,
    isActive: true,
    // demo stock: a size is buyable while the bottle can still fill it
    inStock: input.onHandMl >= ml,
  }));
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

/**
 * Real perfume photos per product (Unsplash, verified resolvable). Each product
 * has a unique primary image plus a couple of supporting shots for the gallery.
 */
const PRODUCT_IMAGE_IDS: Record<string, string[]> = {
  "dior-sauvage-edp": [
    "1541643600914-78b084683601",
    "1547887538-e3a2f32cb1cc",
    "1605651202774-7d573fd3f12d",
  ],
  "chanel-coco-mademoiselle": [
    "1592945403244-b3fbafd7f539",
    "1563170351-be82bc888aa4",
    "1585386959984-a4155224a1ad",
  ],
  "tom-ford-oud-wood": [
    "1588405748880-12d1d2a59f75",
    "1619994403073-2cec844b8e63",
    "1592914610354-fd354ea45e48",
  ],
  "creed-aventus": [
    "1594035910387-fea47794261f",
    "1610461888750-10bfc601b874",
    "1615634260167-c8cdede054de",
  ],
  "ysl-libre-edp": [
    "1610461888750-10bfc601b874",
    "1523293182086-7651a899d37f",
    "1557170334-a9632e77c6e4",
  ],
  "maison-margiela-by-the-fireplace": [
    "1615634260167-c8cdede054de",
    "1547887538-e3a2f32cb1cc",
    "1541643600914-78b084683601",
  ],
  "acqua-di-parma-colonia": [
    "1523293182086-7651a899d37f",
    "1605651202774-7d573fd3f12d",
    "1592945403244-b3fbafd7f539",
  ],
  "jo-malone-wood-sage-sea-salt": [
    "1557170334-a9632e77c6e4",
    "1563170351-be82bc888aa4",
    "1588405748880-12d1d2a59f75",
  ],
};

/** Resolvable perfume image URLs for a product slug. */
export function productImageUrls(slug: string): string[] {
  const ids = PRODUCT_IMAGE_IDS[slug] ?? ["1541643600914-78b084683601"];
  return ids.map(unsplash);
}

export const SEED_PRODUCTS: ProductDetail[] = RAW.map((input) => {
  const variants = buildVariants(input);
  const startingPrice = Math.min(...variants.map((v) => v.price));
  const images = productImageUrls(input.slug).map((url) => ({
    url,
    alt: input.name,
  }));
  return {
    id: input.slug,
    slug: input.slug,
    name: input.name,
    brand: input.brand,
    gender: input.gender,
    concentration: input.concentration,
    scentFamilies: input.scentFamilies,
    seasons: input.seasons ?? [],
    image: images[0],
    images,
    startingPrice,
    tags: input.tags,
    soldOut: !variants.some((v) => v.isActive && v.inStock),
    ratingAvg: input.ratingAvg,
    ratingCount: input.ratingCount,
    // Demo data: sale-tagged seeds show a 10% crossed-out price.
    salePct: input.tags.includes("sale") ? 10 : 0,
    createdAt: new Date(2024, 0, 1 + RAW.indexOf(input)).toISOString(),
    description: input.description,
    notesDescription: input.notesDescription ?? "",
    usageDescription: input.usageDescription ?? "",
    shortDescription: input.shortDescription ?? "",
    notesTop: input.notesTop,
    notesHeart: input.notesHeart,
    notesBase: input.notesBase,
    originCountry: input.originCountry,
    releaseYear: input.releaseYear,
    variants,
    availableMl: input.onHandMl,
    bottleMl: input.bottleMl,
    customTags: [],
  };
});

export const SEED_RAW = RAW;
