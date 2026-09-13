import { z } from "zod";
import type { Season } from "@/db/types";

/**
 * "Үнэрээ ол" quiz content (home page widget).
 *
 * The quiz is deliberately personality-styled: no question asks for a filter
 * value directly. Instead every option carries a hidden weight vector over the
 * signals the DB can actually match on — scent family slugs, seasons and an
 * intensity level derived from concentration. Copy and weights live together
 * here so the wording can be rewritten without touching the scorer.
 *
 * NOTE for future scent families: options reference family slugs statically,
 * so a family added in the admin (scent_families table) only influences quiz
 * results after its slug is added to a weight vector below. Products in an
 * unmapped family still score through season/intensity/gender.
 */

export type Intensity = "light" | "medium" | "strong";

export interface QuizWeights {
  families?: Record<string, number>;
  seasons?: Partial<Record<Season, number>>;
  intensity?: Partial<Record<Intensity, number>>;
  /**
   * Custom-tag slugs (0044 seed, admin-extendable) — use-case and character
   * signals the family/season axes can't express. A slug missing from the
   * admin's pool simply never matches; it doesn't break scoring.
   *
   * Deliberately UNWEIGHTED: pool tags that mirror an axis the scorer already
   * reads — `woody`/`citrus`/`fresh` (scent_families) and `summer`/`winter`
   * (seasons). Weighting them too would count the same signal twice.
   *
   * Slugs are latin by contract (0077_custom_tag_slugs): the admin page
   * transliterates new tag names, so a tag added there can be wired in here
   * without a data migration. `pnpm check:quiz-tags` lists pool slugs that no
   * option weights yet — run it after the client adds tags.
   */
  tags?: Record<string, number>;
}

export interface QuizOption {
  id: string;
  emoji: string;
  /**
   * Tile artwork (3a) — generated from prompts/quiz-options.md. The tile
   * falls back to the emoji while the file doesn't exist yet, so options can
   * ship before their imagery.
   */
  image?: string;
  /**
   * Options whose artwork shows a person are shot twice, so the tile can
   * mirror the gender the visitor picked in the first step instead of showing
   * a model of the other gender. `any` («Unisex») gets the female cut.
   * Takes precedence over `image`, which stays as the last-resort fallback.
   */
  imagesByGender?: { male: string; female: string };
  label: string;
  weights: QuizWeights;
}

export interface QuizQuestion {
  id: string;
  title: string;
  options: QuizOption[];
}

/** First step — the only literal answer (maps straight to products.gender). */
export const GENDER_QUESTION = {
  title: "Ямар төрлийн үнэртэн хайж байна вэ?",
  options: [
    // The "Хүйсээр" cards (prompts/by-gender.md), cropped to their top 80%:
    // the generated artwork carries a brand lockup along the bottom edge that
    // the home page hides with object-top but the quiz tile's centered 3:4
    // crop left visible. No new artwork — public/quiz/gender-*.webp.
    {
      value: "male",
      emoji: "🤵",
      image: "/quiz/gender-male.webp",
      label: "Эрэгтэй",
    },
    {
      value: "female",
      emoji: "💃",
      image: "/quiz/gender-female.webp",
      label: "Эмэгтэй",
    },
    {
      value: "any",
      emoji: "✨",
      image: "/quiz/gender-unisex.webp",
      label: "Unisex",
    },
  ],
} as const;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "weekend",
    title: "Төгс амралтын өдрөө юу хийж өнгөрүүлмээр байна вэ?",
    options: [
      {
        id: "weekend-beach",
        image: "/quiz/weekend-beach.webp",
        emoji: "🏖️",
        label: "Далайн эргээр алхах",
        weights: {
          families: { citrus: 2, fresh: 1 },
          seasons: { summer: 2 },
          tags: { marine: 2, sport: 1, fruity: 1 },
        },
      },
      {
        id: "weekend-forest",
        image: "/quiz/weekend-forest.webp",
        emoji: "🌲",
        label: "Ойгоор алхах",
        weights: {
          families: { woody: 2, fresh: 1 },
          seasons: { autumn: 2 },
          tags: { clean: 1, green: 2, aromatic: 1, herbal: 1 },
        },
      },
      {
        id: "weekend-cozy",
        image: "/quiz/weekend-cozy.webp",
        emoji: "🕯️",
        label: "Лааны гэрэлд ном унших",
        weights: {
          families: { oriental: 2 },
          seasons: { winter: 2 },
          intensity: { strong: 1 },
          tags: { vanilla: 2, amber: 1, gourmand: 2, warm: 1 },
        },
      },
      {
        id: "weekend-garden",
        image: "/quiz/weekend-garden.webp",
        emoji: "🌸",
        label: "Цэцэрлэгээр зугаалах",
        weights: {
          families: { floral: 2 },
          seasons: { spring: 2 },
          tags: { rose: 2, powdery: 1, green: 1, "orange-blossom": 1 },
        },
      },
    ],
  },
  {
    id: "time",
    title: "Өдрийн аль цаг танд хамгийн их таалагддаг вэ?",
    options: [
      {
        id: "time-morning",
        image: "/quiz/time-morning.webp",
        emoji: "🌅",
        label: "Сэрүүн өглөө",
        weights: {
          families: { fresh: 2, citrus: 1 },
          intensity: { light: 2 },
          tags: { clean: 2, daily: 1, green: 1, tea: 1 },
        },
      },
      {
        id: "time-noon",
        image: "/quiz/time-noon.webp",
        emoji: "☀️",
        label: "Нартай үдийн цаг",
        weights: {
          families: { floral: 1, citrus: 1 },
          intensity: { medium: 1 },
          tags: { office: 1, daily: 1, aromatic: 1 },
        },
      },
      {
        id: "time-sunset",
        image: "/quiz/time-sunset.webp",
        emoji: "🌇",
        label: "Нар жаргах үе",
        weights: {
          families: { spicy: 1, oriental: 1 },
          intensity: { medium: 1 },
          tags: { amber: 1, date: 1, warm: 2 },
        },
      },
      {
        id: "time-night",
        image: "/quiz/time-night.webp",
        emoji: "🌙",
        label: "Шөнө дунд",
        weights: {
          families: { oriental: 2, woody: 1 },
          intensity: { strong: 2 },
          tags: { oud: 2, smoky: 1, party: 1, luxurious: 1 },
        },
      },
    ],
  },
  {
    id: "character",
    title: "Бусад хүмүүс таныг хэрхэн дүгнэдэг вэ?",
    options: [
      {
        id: "character-energetic",
        image: "/quiz/character-energetic.webp",
        emoji: "⚡",
        label: "Эрч хүчтэй, хөгжилтэй",
        weights: {
          families: { citrus: 2, fresh: 1 },
          tags: { sport: 1, youthful: 2, fruity: 2, apple: 1, orange: 1 },
        },
      },
      {
        id: "character-romantic",
        image: "/quiz/character-romantic.webp",
        emoji: "💐",
        label: "Романтик, мэдрэмжтэй",
        weights: {
          families: { floral: 2 },
          tags: { rose: 2, date: 2, sweet: 1, gourmand: 1, honey: 1, musk: 1 },
        },
      },
      {
        id: "character-warm",
        image: "/quiz/character-warm.webp",
        emoji: "🔥",
        label: "Дулаан, дотно",
        weights: {
          families: { spicy: 2, oriental: 1 },
          tags: {
            vanilla: 1,
            amber: 2,
            tobacco: 1,
            warm: 2,
            gourmand: 1,
            "bitter-almond": 1,
          },
        },
      },
      {
        id: "character-calm",
        image: "/quiz/character-calm.webp",
        emoji: "🗿",
        label: "Тайван, өөртөө итгэлтэй",
        weights: {
          families: { woody: 2 },
          tags: {
            mature: 2,
            leather: 1,
            signature: 1,
            minimalist: 1,
            aromatic: 1,
            niche: 1,
          },
        },
      },
    ],
  },
  {
    id: "season",
    title: "Аль улиралд хамгийн дуртай вэ?",
    options: [
      {
        id: "season-spring",
        image: "/quiz/season-spring.webp",
        emoji: "🌸",
        label: "Хавар",
        weights: {
          seasons: { spring: 3 },
          families: { floral: 1 },
          tags: { powdery: 1, green: 1 },
        },
      },
      {
        id: "season-summer",
        image: "/quiz/season-summer.webp",
        emoji: "☀️",
        label: "Зун",
        weights: {
          seasons: { summer: 3 },
          families: { citrus: 1 },
          tags: { marine: 1, fruity: 1 },
        },
      },
      {
        id: "season-autumn",
        image: "/quiz/season-autumn.webp",
        emoji: "🍂",
        label: "Намар",
        weights: {
          seasons: { autumn: 3 },
          families: { woody: 1 },
          tags: { tobacco: 1, smoky: 1, warm: 1, nutty: 1 },
        },
      },
      {
        id: "season-winter",
        image: "/quiz/season-winter.webp",
        emoji: "❄️",
        label: "Өвөл",
        weights: {
          seasons: { winter: 3 },
          families: { oriental: 1 },
          tags: { vanilla: 1, oud: 1, gourmand: 1 },
        },
      },
    ],
  },
  {
    id: "impression",
    title: "Алийг нь илүүд үзэх вэ?",
    options: [
      {
        id: "impression-whisper",
        image: "/quiz/impression-whisper.webp",
        emoji: "🤫",
        label: "Ойртоход мэдрэгдэнэ",
        weights: { intensity: { light: 3 }, tags: { clean: 1, office: 1, light: 1 } },
      },
      {
        id: "impression-balanced",
        image: "/quiz/impression-balanced-female.webp",
        imagesByGender: {
          male: "/quiz/impression-balanced-male.webp",
          female: "/quiz/impression-balanced-female.webp",
        },
        emoji: "🙂",
        label: "Хажуугаар зөрөхөд мэдрэгдэнэ",
        weights: {
          intensity: { medium: 3 },
          tags: { daily: 1, office: 1, versatile: 1 },
        },
      },
      {
        id: "impression-bold",
        image: "/quiz/impression-bold-female.webp",
        imagesByGender: {
          male: "/quiz/impression-bold-male.webp",
          female: "/quiz/impression-bold-female.webp",
        },
        emoji: "💫",
        label: "Өрөөнд орж ирэхэд л анзаарагдана",
        weights: {
          intensity: { strong: 3 },
          tags: {
            "long-lasting": 2,
            party: 1,
            signature: 1,
            luxurious: 2,
            special: 1,
          },
        },
      },
    ],
  },
];

export const quizAnswersSchema = z.object({
  gender: z.enum(["male", "female", "any"]),
  picks: z.array(z.string().max(40)).max(QUIZ_QUESTIONS.length),
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
