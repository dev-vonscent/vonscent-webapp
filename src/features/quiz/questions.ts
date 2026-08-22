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
}

export interface QuizOption {
  id: string;
  emoji: string;
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
    { value: "male", emoji: "🤵", label: "Эрэгтэй" },
    { value: "female", emoji: "💃", label: "Эмэгтэй" },
    { value: "any", emoji: "✨", label: "Хамаагүй" },
  ],
} as const;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "weekend",
    title: "Төгс амралтын өдрөө хаана өнгөрүүлмээр байна вэ?",
    options: [
      {
        id: "weekend-beach",
        emoji: "🏖️",
        label: "Далайн эргээр зугаалж, наранд шарна",
        weights: {
          families: { citrus: 2, fresh: 1 },
          seasons: { summer: 2 },
        },
      },
      {
        id: "weekend-forest",
        emoji: "🌲",
        label: "Ойн дундуур алхана",
        weights: {
          families: { woody: 2, fresh: 1 },
          seasons: { autumn: 2 },
        },
      },
      {
        id: "weekend-cozy",
        emoji: "🕯️",
        label: "Гэртээ лаа асааж, ном уншина",
        weights: {
          families: { oriental: 2 },
          seasons: { winter: 2 },
          intensity: { strong: 1 },
        },
      },
      {
        id: "weekend-garden",
        emoji: "🌸",
        label: "Цэцэглэсэн цэцэрлэгээр зугаална",
        weights: {
          families: { floral: 2 },
          seasons: { spring: 2 },
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
        emoji: "🌅",
        label: "Сэрүүн өглөө",
        weights: {
          families: { fresh: 2, citrus: 1 },
          intensity: { light: 2 },
        },
      },
      {
        id: "time-noon",
        emoji: "☀️",
        label: "Нартай үдийн цаг",
        weights: {
          families: { floral: 1, citrus: 1 },
          intensity: { medium: 1 },
        },
      },
      {
        id: "time-sunset",
        emoji: "🌇",
        label: "Нар жаргах үе",
        weights: {
          families: { spicy: 1, oriental: 1 },
          intensity: { medium: 1 },
        },
      },
      {
        id: "time-night",
        emoji: "🌙",
        label: "Гүн шөнө",
        weights: {
          families: { oriental: 2, woody: 1 },
          intensity: { strong: 2 },
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
        emoji: "⚡",
        label: "Эрч хүчтэй, хөгжилтэй",
        weights: { families: { citrus: 2, fresh: 1 } },
      },
      {
        id: "character-romantic",
        emoji: "💐",
        label: "Романтик, мэдрэмжтэй",
        weights: { families: { floral: 2 } },
      },
      {
        id: "character-warm",
        emoji: "🔥",
        label: "Дулаан, дотно",
        weights: { families: { spicy: 2, oriental: 1 } },
      },
      {
        id: "character-calm",
        emoji: "🗿",
        label: "Тайван, өөртөө итгэлтэй",
        weights: { families: { woody: 2 } },
      },
    ],
  },
  {
    id: "season",
    title: "Хамгийн дуртай улирал тань аль нь вэ?",
    options: [
      {
        id: "season-spring",
        emoji: "🌸",
        label: "Хавар",
        weights: { seasons: { spring: 3 }, families: { floral: 1 } },
      },
      {
        id: "season-summer",
        emoji: "☀️",
        label: "Зун",
        weights: { seasons: { summer: 3 }, families: { citrus: 1 } },
      },
      {
        id: "season-autumn",
        emoji: "🍂",
        label: "Намар",
        weights: { seasons: { autumn: 3 }, families: { woody: 1 } },
      },
      {
        id: "season-winter",
        emoji: "❄️",
        label: "Өвөл",
        weights: { seasons: { winter: 3 }, families: { oriental: 1 } },
      },
    ],
  },
  {
    id: "impression",
    title: "Таны үнэр хүмүүст ямар сэтгэгдэл үлдээх ёстой вэ?",
    options: [
      {
        id: "impression-whisper",
        emoji: "🤫",
        label: "Зөвхөн ойртсон хүнд л мэдрэгдэнэ",
        weights: { intensity: { light: 3 } },
      },
      {
        id: "impression-balanced",
        emoji: "🙂",
        label: "Тэнцвэртэй, яг таг",
        weights: { intensity: { medium: 3 } },
      },
      {
        id: "impression-bold",
        emoji: "💫",
        label: "Хажуугаар өнгөрөхөд эргэж харуулна",
        weights: { intensity: { strong: 3 } },
      },
    ],
  },
];

export const quizAnswersSchema = z.object({
  gender: z.enum(["male", "female", "any"]),
  picks: z.array(z.string().max(40)).max(QUIZ_QUESTIONS.length),
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
