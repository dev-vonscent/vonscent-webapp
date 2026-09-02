/**
 * Mongolian fragrance note → English ingredient name.
 *
 * The catalogue stores notes in Mongolian (`products.notes_top/heart/base`),
 * which is right for the storefront and useless for an image model: gpt-image
 * will not render «Царсны хөвд» but renders "oak moss" perfectly well.
 *
 * The mapping is not invented. It is `docs/import/enrichment/notes.mn.json` —
 * the English→Mongolian table the original import used — inverted, so each
 * entry is the exact source term rather than a re-translation, plus the notes
 * that entered the catalogue after that file was written.
 *
 * The table is **inlined rather than read from disk**: this module runs inside
 * the Next server (new-product image pipeline) as well as in the batch script,
 * and `docs/` is not deployed with the app.
 */

/** Mongolian → English. */
const TABLE: Record<string, string> = {
  "Айва": "Quince",
  "Аквозон": "Aquozone",
  "Акигалавуд": "Akigalawood®",
  "Алим": "Apple",
  "Альдегид": "Aldehydes",
  "Амбер": "Amber",
  "Амбер мод": "Amberwood",
  "Амбермакс": "Ambermax",
  "Амберын аялгуу": "Amber notes",
  "Амбра": "Ambergris",
  "Амбреттийн үр": "Ambrette seed",
  "Амбреттийн үрийн абсолют": "Ambrette seed absolute",
  "Амброкс": "Ambrox",
  "Амброксан": "Ambroxan",
  "Амброфикс": "Ambrofix",
  "Амтлагч": "Spices",
  "Ананас": "Pineapple",
  "Ананасын сорбет": "Pineapple sorbet",
  "Ангелика": "Angelica",
  "Анис": "Aniseed",
  "Анхилуун вандуй": "Sweet pea",
  "Анхилуун чинжүү": "Pimento",
  "Арц": "Juniper",
  "Арцны жимс": "Juniper berry",
  "Арьс шир": "Leather",
  "Атласын кедр": "Atlas cedar",
  "Базилик": "Basil",
  "Бальзам гацуур": "Balsam fir",
  "Бензоин": "Benzoin",
  "Бергамот": "Bergamot",
  "Бразилын ногоон мандарин": "Brazilian green mandarin orange",
  "Бубинга мод": "Bubinga wood",
  "Бурбон ваниль": "Bourbon vanilla",
  "Бурбон герань": "Bourbon geranium",
  "Бөөрөлзгөнө": "Raspberry",
  "Ванилийн цэцэг": "Vanilla flower",
  "Ванилин": "Vanillin",
  "Ваниль": "Vanilla",
  "Венесуэлийн тонка шош": "Venezuelan tonka bean",
  "Вербена": "Vervain",
  "Ветивер": "Vetiver",
  "Виржиниагийн кедр": "Virginia cedar",
  "Гаитийн ветивер": "Haitian vetiver",
  "Гальбанум": "Galbanum",
  "Гардени": "Gardenia",
  "Гашуун бүйлс": "Bitter almond",
  "Гашуун жүрж": "Bitter orange",
  "Гашуун жүржийн навч": "Bitter orange leaf",
  "Гватемалын кардамон": "Guatemala cardamom",
  "Гватемалын пачули": "Guatemala patchouli",
  "Гвоздик": "Clove",
  "Гедион": "Hedione",
  "Гельветолид": "Helvetolide®",
  "Герангийн навч": "Geranium leaf",
  "Герань": "Geranium",
  "Гиацинт": "Hyacinth",
  "Гималайн кедр": "Himalayan cedar",
  "Голт бор": "Lilac",
  "Грассын сарнай": "Grasse rose",
  "Грейпфрут": "Grapefruit",
  "Гуаяк мод": "Gaiac wood",
  "Гүзээлзгэнэ": "Strawberry",
  "Гүнжид": "Sesame",
  "Давс": "Salt",
  "Далайн аялгуу": "Marine notes",
  "Далайн өвс": "Neptune grass",
  "Дамаскийн сарнай": "Damask rose",
  "Дарчин": "Cinnamon",
  "Датура": "Datura",
  "Дорнын мод": "Oriental woods",
  "Египетийн акац": "Egyptian acacia",
  "Египетийн герань": "Egyptian geranium",
  "Египетийн том цэцэгт жасмин": "Egyptian jasmine grandiflorum",
  "Жасмин": "Jasmine",
  "Жасмин цай": "Jasmine tea",
  "Жасмины абсолют": "Jasmine absolute",
  "Жоржвуд": "Georgywood®",
  "Жүрж": "Orange",
  "Жүржийн цэцгийн абсолют": "Orange blossom absolute",
  "Жүржийн цэцэг": "Orange blossom",
  "Зира": "Cumin",
  "Зуун дэлбээт сарнай": "Rosa centifolia",
  "Иланг-иланг": "Ylang-ylang",
  "Илгэн арьс": "Suede",
  "Индонезийн пачули": "Indonesian patchouli",
  "Инжир": "Fig",
  "Ирис": "Iris",
  "Ирисын үндэсний абсолют": "Orris absolute",
  "Ирисын үндэсний концрет": "Orris concrete",
  "Ирисын үндэсний тос": "Orris butter",
  "Италийн бергамот": "Italian bergamot",
  "Италийн мандарин": "Italian mandarin orange",
  "Италийн нимбэг": "Italian lemon",
  "Кадын арц": "Cade juniper",
  "Какао": "Cocoa",
  "Калабрын бергамот": "Calabrian bergamot",
  "Карамельдсэн кофены үр": "Caramelized coffee bean",
  "Кардамон": "Cardamom",
  "Кашмер мод": "Cashmere wood",
  "Кашмеран": "Cashmeran",
  "Каштан": "Chestnut",
  "Кедр": "Cedar",
  "Кедр мод": "Cedarwood",
  "Кедрийн навч": "Cedar leaf",
  "Кипарис": "Cypress",
  "Клирвуд": "Clearwood™",
  "Кориандр": "Coriander",
  "Кориандрын үр": "Coriander seed",
  "Кофе": "Coffee",
  "Лабданум": "Labdanum",
  "Лаванда": "Lavender",
  "Ладан": "Frankincense",
  "Лийр": "Pear",
  "Лийрийн цэцэг": "Pear blossom",
  "Личи": "Lychee",
  "Ловаж": "Lovage",
  "Лууваны үр": "Carrot seed",
  "Мадагаскарын ваниль": "Madagascar vanilla",
  "Мандарин": "Mandarin orange",
  "Маракуйа": "Passionfruit",
  "Мастикийн абсолют": "Mastic absolute",
  "Мимоза": "Mimosa",
  "Модлог аялгуу": "Woods",
  "Мускат самар": "Nutmeg",
  "Мускат шалфей": "Clary sage",
  "Мускус": "Musk",
  "Мята": "Mint",
  "Наргил": "Coconut",
  "Наргилын ус": "Coconut water",
  "Нарс": "Pine",
  "Нарсны шилмүүс": "Pine needle",
  "Нероли": "Neroli",
  "Нигерийн цагаан гаа": "Nigerian ginger",
  "Нил цэцгийн навч": "Violet leaf",
  "Нил цэцгийн навчны абсолют": "Violet leaf absolute",
  "Нил цэцэг": "Violet",
  "Нимбэг": "Lemon",
  "Ногоон алим": "Green apple",
  "Ногоон инжир": "Green fig",
  "Ногоон мандарин": "Green mandarin",
  "Ногоон мята": "Spearmint",
  "Нооткагийн кипарис": "Nootka cypress",
  "Одон анис": "Star anise",
  "Озоны аялгуу": "Ozonic notes",
  "Опопонакс": "Opoponax",
  "Орканокс": "Orcanox",
  "Османтус": "Osmanthus",
  "Папуа Шинэ Гвинейн ваниль": "Papua New Guinean vanilla",
  "Пачули": "Patchouli",
  "Перугийн бальзам": "Peru balsam",
  "Петитгрейн": "Petitgrain",
  "Провансын лаванда": "Provençal lavender",
  "Ревень": "Rhubarb",
  "Розмарин": "Rosemary",
  "Ром": "Rum",
  "Самбак жасмин": "Jasmine sambac",
  "Сандал мод": "Sandalwood",
  "Сантолина": "Santolina",
  "Сарнай": "Rose",
  "Сарнайн мод": "Rosewood",
  "Сарнайн цай": "Rose tea",
  "Сиамын бензоин": "Siam benzoin",
  "Сицилийн жүрж": "Sicilian orange",
  "Сицилийн кедр": "Sicilian cedar",
  "Сицилийн мандарин": "Sicilian mandarin orange",
  "Сицилийн нимбэг": "Sicilian lemon",
  "Сычуань чинжүү": "Sichuan pepper",
  "Тавдугаар сарын сарнай": "May rose",
  "Тамхины навч": "Tobacco",
  "Танжерин": "Tangerine",
  "Тархун": "Tarragon",
  "Тик мод": "Teakwood",
  "Тмин": "Caraway",
  "Том цэцэгт жасмин": "Jasmine grandiflorum",
  "Том цэцэгт жасмины абсолют": "Jasminum grandiflorum absolute",
  "Тонка шош": "Tonka bean",
  "Тоор": "Peach",
  "Тоффи": "Toffee",
  "Тубероза": "Tuberose",
  "Тунисын жүржийн цэцэг": "Tunisian orange blossom",
  "Тунисын нероли": "Tunisian neroli",
  "Туркийн сарнай": "Turkish rose",
  "Уд мод": "Oud",
  "Улаан алим": "Red apple",
  "Улаан жимс": "Red berries",
  "Улаан замаг": "Red algae",
  "Утаат ветивер": "Smoked vetiver",
  "Утлага": "Incense",
  "Финик": "Date",
  "Флоренцийн ирис": "Florentine iris",
  "Франжипани": "Frangipani",
  "Францын лаванда": "French lavender",
  "Хар арьс шир": "Black leather",
  "Хар бөөрөлзгөнө": "Blackberry",
  "Хар чинжүү": "Black pepper",
  "Хар шарилж": "Mugwort",
  "Хар үхрийн нүд": "Blackcurrant",
  "Хус": "Birch",
  "Хятад жасмин": "Chinese jasmine",
  "Хятад хар цайны ханд": "Chinese black tea CO2",
  "Хүйтэн мята": "Peppermint",
  "Хүрэн элсэн чихэр": "Brown sugar",
  "Хөвд": "Moss",
  "Хөндийн сараана": "Lily of the valley",
  "Цагаан гаа": "Ginger",
  "Цагаан мускус": "White musk",
  "Цагаан хөвд": "White moss",
  "Цай": "Tea",
  "Царсны хөвд": "Oakmoss",
  "Цахиур чулуу": "Flintstone",
  "Цейлоны дарчин": "Ceylonese cinnamon",
  "Цитрон": "Citron",
  "Цитрус": "Citrus",
  "Цитрусын аялгуу": "Citrus notes",
  "Цусан мандарин": "Blood mandarin",
  "Цуу": "Vinegar",
  "Цээнэ цэцэг": "Peony",
  "Чангаанз": "Apricot",
  "Чили чинжүү": "Chili",
  "Чинжүү": "Pepper",
  "Чинжүү мод": "Pepperwood",
  "Чихэр өвс": "Liquorice",
  "Чихэрлэг алим": "Sweet apple",
  "Шалфей": "Sage",
  "Шарилж": "Artemisia",
  "Шафран": "Saffron",
  "Шинэ Каледонийн сандал мод": "New Caledonian sandalwood",
  "Элеми давирхай": "Elemi resin",
  "Энэтхэгийн сандал мод": "Indian sandalwood",
  "Эрдэс амбер": "Mineral amber",
  "Эрдэс аялгуу": "Mineral notes",
  "Эрдэс давс": "Mineral salt",
  "Ягаан чинжүү": "Pink pepper",
  "Өмнөд Италийн бергамот": "South Italian bergamot",};

/**
 * Notes with no photographable form: synthetic captive molecules (Ambroxan,
 * Cashmeran), abstract accords ("woody notes", "marine notes") and animalic
 * abstractions (musk). Asking for these produces the model's guess at what a
 * molecule looks like — usually an invented lump of resin — so they are
 * dropped before the prompt is built rather than rendered badly.
 */
const ABSTRACT = new Set(
  [
    "Akigalawood",
    "Aldehydes",
    "Amber",
    "Amber notes",
    "Ambergris",
    "Ambermax",
    "Amberwood",
    "Ambrofix",
    "Ambrox",
    "Ambroxan",
    "Aquozone",
    "Cashmeran",
    "Cashmere wood",
    "Citrus",
    "Citrus notes",
    "Clearwood",
    "Georgywood",
    "Helvetolide",
    "Marine notes",
    "Mineral amber",
    "Mineral notes",
    "Musk",
    "Orcanox",
    "Oriental wood",
    "Oriental woods",
    "Ozonic notes",
    "Vanillin",
    "White musk",
    "Woods",
    "Woody notes",  ].map((s) => s.toLowerCase()),
);

/** Is this note something a camera could actually photograph? */
export function isPhotographable(en: string): boolean {
  // The perfume databases carry the trademark sign on captive molecules
  // («Clearwood™»), which would otherwise slip past the list above.
  return !ABSTRACT.has(en.replace(/[®™]/g, "").trim().toLowerCase());
}

/** English name for one Mongolian note, or null if the table has no entry. */
export function toEnglish(mn: string): string | null {
  return TABLE[mn.trim()] ?? null;
}

/**
 * The ingredients to put behind the bottle, at most `limit`.
 *
 * Drawn one tier at a time — top, then heart, then base — rather than taking
 * the first five of a flattened list, so a perfume whose top notes are all
 * citrus still contributes its heart flower and its base wood. That spread is
 * what makes the arrangement read as *this* fragrance rather than as a bowl of
 * lemons.
 */
export function pickNotes(
  tiers: { top: string[]; heart: string[]; base: string[] },
  limit = 5,
): string[] {
  const queues = [[...tiers.top], [...tiers.heart], [...tiers.base]];
  const out: string[] = [];
  const seen = new Set<string>();
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (out.length >= limit) break;
      while (q.length) {
        const en = toEnglish(q.shift()!);
        if (!en || !isPhotographable(en)) continue;
        const key = en.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(en);
        break;
      }
    }
  }
  return out;
}
