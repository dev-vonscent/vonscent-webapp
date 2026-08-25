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
  title: "Хэнд зориулсан үнэр хайж байна вэ?",
  options: [
    // Reuses the "Хүйсээр" cards (prompts/by-gender.md) — no new artwork.
    { value: "male", emoji: "🤵", image: "/gender-male.webp", label: "Эрэгтэй" },
    { value: "female", emoji: "💃", image: "/gender-female.webp", label: "Эмэгтэй" },
    { value: "any", emoji: "✨", image: "/gender-unisex.webp", label: "Хамаагүй" },
  ],
} as const;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "weekend",
    title: "Төгс амралтын өдрөө хаана өнгөрүүлмээр байна вэ?",
    options: [
      {
        id: "weekend-beach",
        image: "/quiz/weekend-beach-v2.webp",
        emoji: "🏖️",
        label: "Далайн эргээр зугаалж, наранд шарна",
        weights: {
          families: { citrus: 2, fresh: 1 },
          seasons: { summer: 2 },
          tags: { marine: 2, sport: 1 },
        },
      },
      {
        id: "weekend-forest",
        image: "/quiz/weekend-forest-v2.webp",
        emoji: "🌲",
        label: "Ойн дундуур алхана",
        weights: {
          families: { woody: 2, fresh: 1 },
          seasons: { autumn: 2 },
          tags: { clean: 1 },
        },
      },
      {
        id: "weekend-cozy",
        image: "/quiz/weekend-cozy-v2.webp",
        emoji: "🕯️",
        label: "Гэртээ лаа асааж, ном уншина",
        weights: {
          families: { oriental: 2 },
          seasons: { winter: 2 },
          intensity: { strong: 1 },
          tags: { vanilla: 2, amber: 1 },
        },
      },
      {
        id: "weekend-garden",
        image: "/quiz/weekend-garden-v2.webp",
        emoji: "🌸",
        label: "Цэцэглэсэн цэцэрлэгээр зугаална",
        weights: {
          families: { floral: 2 },
          seasons: { spring: 2 },
          tags: { rose: 2, powdery: 1 },
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
        image: "/quiz/time-morning-v2.webp",
        emoji: "🌅",
        label: "Сэрүүн өглөө",
        weights: {
          families: { fresh: 2, citrus: 1 },
          intensity: { light: 2 },
          tags: { clean: 2, daily: 1 },
        },
      },
      {
        id: "time-noon",
        image: "/quiz/time-noon-v2.webp",
        emoji: "☀️",
        label: "Нартай үдийн цаг",
        weights: {
          families: { floral: 1, citrus: 1 },
          intensity: { medium: 1 },
          tags: { office: 1, daily: 1 },
        },
      },
      {
        id: "time-sunset",
        image: "/quiz/time-sunset-v2.webp",
        emoji: "🌇",
        label: "Нар жаргах үе",
        weights: {
          families: { spicy: 1, oriental: 1 },
          intensity: { medium: 1 },
          tags: { amber: 1, date: 1 },
        },
      },
      {
        id: "time-night",
        image: "/quiz/time-night-v2.webp",
        emoji: "🌙",
        label: "Гүн шөнө",
        weights: {
          families: { oriental: 2, woody: 1 },
          intensity: { strong: 2 },
          tags: { oud: 2, smoky: 1, party: 1 },
        },
      },
    ],
  },
  {
    id: "character",
    title: "Найзууд тань таныг хэрхэн дүрсэлдэг вэ?",
    options: [
      {
        id: "character-energetic",
        image: "/quiz/character-energetic-v2.webp",
        emoji: "⚡",
        label: "Эрч хүчтэй, хөгжилтэй",
        weights: { families: { citrus: 2, fresh: 1 }, tags: { sport: 1, youthful: 2 } },
      },
      {
        id: "character-romantic",
        image: "/quiz/character-romantic-v2.webp",
        emoji: "💐",
        label: "Романтик, мэдрэмжтэй",
        weights: { families: { floral: 2 }, tags: { rose: 2, date: 2, sweet: 1 } },
      },
      {
        id: "character-warm",
        image: "/quiz/character-warm-v2.webp",
        emoji: "🔥",
        label: "Дулаан, дотно",
        weights: { families: { spicy: 2, oriental: 1 }, tags: { vanilla: 1, amber: 2, tobacco: 1 } },
      },
      {
        id: "character-calm",
        image: "/quiz/character-calm-v2.webp",
        emoji: "🗿",
        label: "Тайван, өөртөө итгэлтэй",
        weights: { families: { woody: 2 }, tags: { mature: 2, leather: 1, signature: 1 } },
      },
    ],
  },
  {
    id: "season",
    title: "Хамгийн дуртай улирал тань аль нь вэ?",
    options: [
      {
        id: "season-spring",
        image: "/quiz/season-spring-v2.webp",
        emoji: "🌸",
        label: "Хавар",
        weights: { seasons: { spring: 3 }, families: { floral: 1 }, tags: { powdery: 1 } },
      },
      {
        id: "season-summer",
        image: "/quiz/season-summer-v2.webp",
        emoji: "☀️",
        label: "Зун",
        weights: { seasons: { summer: 3 }, families: { citrus: 1 }, tags: { marine: 1 } },
      },
      {
        id: "season-autumn",
        image: "/quiz/season-autumn-v2.webp",
        emoji: "🍂",
        label: "Намар",
        weights: { seasons: { autumn: 3 }, families: { woody: 1 }, tags: { tobacco: 1, smoky: 1 } },
      },
      {
        id: "season-winter",
        image: "/quiz/season-winter-v2.webp",
        emoji: "❄️",
        label: "Өвөл",
        weights: { seasons: { winter: 3 }, families: { oriental: 1 }, tags: { vanilla: 1, oud: 1 } },
      },
    ],
  },
  {
    id: "impression",
    title: "Таны үнэр хүмүүст ямар сэтгэгдэл үлдээх ёстой вэ?",
    options: [
      {
        id: "impression-whisper",
        image: "/quiz/impression-whisper-v2.webp",
        emoji: "🤫",
        label: "Зөвхөн ойртсон хүнд л мэдрэгдэнэ",
        weights: { intensity: { light: 3 }, tags: { clean: 1, office: 1 } },
      },
      {
        id: "impression-balanced",
        image: "/quiz/impression-balanced-v2.webp",
        emoji: "🙂",
        label: "Тэнцвэртэй, яг таг",
        weights: { intensity: { medium: 3 }, tags: { daily: 1, office: 1 } },
      },
      {
        id: "impression-bold",
        image: "/quiz/impression-bold-v2.webp",
        emoji: "💫",
        label: "Хажуугаар өнгөрөхөд эргэж харуулна",
        weights: { intensity: { strong: 3 }, tags: { "long-lasting": 2, party: 1, signature: 1 } },
      },
    ],
  },
];

export const quizAnswersSchema = z.object({
  gender: z.enum(["male", "female", "any"]),
  picks: z.array(z.string().max(40)).max(QUIZ_QUESTIONS.length),
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
