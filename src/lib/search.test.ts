import { describe, expect, it } from "vitest";
import {
  isSearchable,
  matchesSearch,
  normalizeSearchText,
  searchTerms,
} from "./search";

describe("normalizeSearchText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeSearchText("Hermès Terre d'Hermès")).toBe(
      "hermes terre d'hermes",
    );
  });

  it("transliterates Mongolian Cyrillic to Latin", () => {
    expect(normalizeSearchText("Диор")).toBe("dior");
    expect(normalizeSearchText("Түмэн")).toBe("tumen");
  });
});

describe("matchesSearch", () => {
  it("matches Cyrillic queries against Latin names", () => {
    expect(matchesSearch("Dior Sauvage", "диор")).toBe(true);
    expect(matchesSearch("Tom Ford Oud Wood", "том форд")).toBe(true);
  });

  it("matches terms in any order", () => {
    expect(matchesSearch("Dior Sauvage", "sauvage dior")).toBe(true);
  });

  it("rejects when any term is missing", () => {
    expect(matchesSearch("Dior Sauvage", "диор хомм")).toBe(false);
  });

  it("still matches plain Latin and Cyrillic tags", () => {
    expect(matchesSearch("Bleu de Chanel оффис", "оффис")).toBe(true);
  });
});

describe("searchTerms", () => {
  it("folds and splits the query the way global_search() expects", () => {
    expect(searchTerms("  Диор   Соваж ")).toEqual(["dior", "sovaj"]);
  });

  it("drops empty terms", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("isSearchable", () => {
  it("needs at least MIN_SEARCH_LENGTH folded characters", () => {
    expect(isSearchable("t")).toBe(false);
    expect(isSearchable("  т  ")).toBe(false);
    expect(isSearchable("то")).toBe(true);
    expect(isSearchable("")).toBe(false);
  });

  it("counts the folded form, not the typed one", () => {
    // «ь» нь хэвийн болгоход алга болдог тул «ть» нь нэг л тэмдэгт.
    expect(isSearchable("ть")).toBe(false);
    // «ц» → "ts": нэг үсэг ч хангалттай урт болно.
    expect(isSearchable("ц")).toBe(true);
  });
});

/**
 * ХЭВИЙН БОЛГОЛТЫН ЦООЖ (backlog H1).
 *
 * Глобал хайлт хоёр хэрэгжилтээс хамаарна:
 *   • TS `normalizeSearchText()` — хайх ҮГ (энэ файл)
 *   • SQL `search_normalize()`  — хайгдах ТЕКСТ, `search_text` багана болж
 *     хадгалагддаг (supabase/migrations/0057_search.sql)
 *
 * Аль нэгийг л засвал хайлт ЧИМЭЭГҮЙ буруудна: «диор» гэж бичихэд Dior
 * олдохоо болино, харин ямар ч алдаа гарахгүй. Доорх хүснэгт нь TS талын
 * гаралтыг цоожилно — өөрчлөгдвөл энэ тест унаж, SQL талыг ч зэрэг засах
 * шаардлагатайг сануулна.
 *
 * ⚠️ Энэ тест унасан бол:
 *   1. `supabase/migrations/0057_search.sql`-ийн `search_normalize()`-ийг мөн
 *      адил засах (шинэ migration-аар),
 *   2. `pnpm check:search-parity` ажиллуулж бодит өгөгдөл дээр паритетыг
 *      батлах (DATABASE_URL шаардана),
 *   3. дараа нь доорх хүлээлтийг шинэ гаралтаар нь шинэчлэх.
 * Зөвхөн хүлээлтийг засаад өнгөрвөл хайлт бүтэн хагас нь ажиллахгүй болно.
 *
 * Хүлээлтүүд нь ТАAМАГЛАЛ БИШ — хэрэгжилтээс бодитоор хэмжиж авсан.
 */
const NORMALIZE_LOCK: Record<string, string> = {
  // Латин: том/жижиг, өргөлт (үнэртний нэрс өргөлтөөр дүүрэн).
  "Dior Sauvage": "dior sauvage",
  "Hermès Terre d'Hermès": "hermes terre d'hermes",
  "Yves Saint Laurent": "yves saint laurent",

  // Кирилл → латин хөрвүүлэлт.
  "Диор Соваж": "dior sovaj",
  "ТОМ ФОРД": "tom ford",
  "Жо Малон": "jo malon",
  Түмэн: "tumen",

  // ⚠️ «Ё» нь NFKD-д Е + нийлмэл тэмдэг болж задарч, тэмдэг нь хасагддаг тул
  // `ё: "yo"` дүрэм ХЭЗЭЭ Ч хэрэгжихгүй — гаралт «yo» биш «e». SQL тал ч яг
  // ижил дарааллаар (задаргаа → тэмдэг хасах → жижиглэх) явдаг тул таарна.
  Ёлка: "elka",
  "щётка ъь": "shetka ",

  // Монгол өргөтгөл: ө ба ү хоёул «u» (ө → «o» БИШ).
  "Өдөр тутмын ХЭРЭГЛЭЭ": "udur tutmin khereglee",

  // Нийцтэй байдлын тэмдэгтүүд задарч, дараа нь жижигрэнэ: № → No → «no».
  "Шанель №5": "shanel no5",
  "ﬁ ligature": "fi ligature",

  // Бүтэн кирилл цагаан толгой — үсэг тус бүрийн зураглалыг нэг мөрөнд.
  // ъ / ь нь алга болно, й ба ы нь «i», щ нь ш-тэй ижил «sh».
  абвгдеёжзийклмноөпрстуүфхцчшщъыьэюя:
    "abvgdeejziiklmnouprstuufkhtschshshieyuya",
  // Том тэмдэгтээр бичсэн ч мөн ижил гаралт.
  АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ:
    "abvgdeejziiklmnouprstuufkhtschshshieyuya",

  // `normalizeSearchText` нь зайг ХУРААДАГГҮЙ — тэр нь `searchTerms`-ийн үүрэг.
  "  олон   зайтай  ": "  olon   zaitai  ",
};

describe("normalizeSearchText — SQL-тай паритетын цоож", () => {
  it("хэвийн болголтын гаралт өөрчлөгдөөгүй", () => {
    const actual: Record<string, string> = {};
    for (const input of Object.keys(NORMALIZE_LOCK)) {
      actual[input] = normalizeSearchText(input);
    }
    expect(
      actual,
      "Хэвийн болголт өөрчлөгдсөн. 0057_search.sql-ийн search_normalize()-ийг " +
        "мөн засаж, `pnpm check:search-parity` ажиллуулж баталгаажуулсны " +
        "ДАРAА энэ хүснэгтийг шинэчил.",
    ).toEqual(NORMALIZE_LOCK);
  });

  it("зай хураах нь searchTerms-ийн үүрэг хэвээр", () => {
    expect(searchTerms("  олон   зайтай  ")).toEqual(["olon", "zaitai"]);
  });
});
