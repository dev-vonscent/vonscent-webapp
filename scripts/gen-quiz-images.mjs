#!/usr/bin/env node
/**
 * Generates the "Үнэрээ ол" quiz option tiles and the two home-widget side
 * images with the OpenAI Images API. Files that already exist are skipped,
 * so reruns only fill the gaps. Prompt record: prompts/quiz-options.md.
 *
 * Usage: OPENAI_API_KEY=sk-... node scripts/gen-quiz-images.mjs
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MODEL = "gpt-image-1"; // the team may switch this to a newer image model
const SIZE = "1024x1536";
const QUALITY = "high";

/** Option tiles express the OPTION's meaning (a beach, a candle, a rose…) in
 *  full natural color — never a product shot, never dark-on-dark: the tile's
 *  own bottom gradient keeps bright images readable on the dark UI, and they
 *  must also work on the light theme. */
const optionPrompt = (subject) =>
  `Beautiful atmospheric photograph of ${subject}, the subject large, clearly visible and filling the frame, natural vibrant colors, bright cinematic lighting, professional editorial photography, shallow depth of field, premium minimalist composition, vertical format. Strictly no perfume bottles, no glass flasks, no cosmetic products, no people holding products, no text, no logos.`;

/** The widget side images legitimately show fragrance subjects (ingredients,
 *  decant vials) and keep the editorial style — brightened. */
const widgetPrompt = (subject) =>
  `Luxury fragrance editorial photograph, ${subject}, deep charcoal background, dramatic studio lighting with a warm golden glow from one side, subtle warm accents, generous negative space, premium fragrance advertisement aesthetic, cinematic, vertical composition, warm inviting lighting, rich visible detail, not dark.`;

/** Quiz option tiles → public/quiz/{id}-v2.webp. Filenames are versioned so a
 *  regeneration ships under fresh URLs (no stale optimizer/browser caches);
 *  bump the suffix when regenerating. The gender question reuses the existing
 *  cards (public/gender-*.webp); the season question gets its own portrait
 *  tiles here — the landscape home-page season-*.jpg crops too small in the
 *  3:4 tile and looks soft. */
const OPTION_SUBJECTS = {
  "weekend-beach": "turquoise ocean waves rolling onto a sunlit sandy beach under a blue sky",
  "weekend-forest": "a green pine forest path with morning sunrays streaming through the trees",
  "weekend-cozy": "a warm lit candle and an open book on a knitted blanket, cozy golden interior light",
  "weekend-garden": "a lush blooming flower garden in soft morning light, pink and white blossoms",
  "time-morning": "golden sunrise light breaking over misty green hills",
  "time-noon": "bright midday sun over fresh citrus fruits and green leaves",
  "time-sunset": "a vivid orange and pink sunset sky over a calm horizon",
  "time-night": "a starry night sky with a bright crescent moon over silhouetted mountains",
  "character-energetic": "a dynamic splash of orange juice and citrus slices frozen mid-air on a bright background",
  "character-romantic": "a bouquet of deep red roses with soft warm light",
  "character-warm": "glowing fireplace embers with cinnamon sticks and star anise, warm amber tones",
  "character-calm": "smooth grey stones stacked in balance beside calm water, soft neutral light",
  "season-spring": "blooming pink cherry blossom branches against a soft blue spring sky",
  "season-summer": "a sunlit green summer meadow full of colorful wildflowers under a clear blue sky",
  "season-autumn": "vibrant golden and red maple leaves glowing in warm low autumn sunlight",
  "season-winter": "snow-covered pine branches sparkling in soft winter sunlight, cool blue tones",
  "impression-whisper": "a delicate wisp of white mist floating in soft pastel light",
  "impression-balanced": "a serene zen composition of a leaf floating on still clear water",
  "impression-bold": "a dramatic burst of colorful smoke swirling against a bright backdrop",
};

/** Home-widget side imagery (scent-quiz.tsx intro / page.tsx bundle promo). */
const WIDGET_SUBJECTS = {
  "quiz-side":
    "raw perfume ingredients on black stone — bergamot slices, vanilla pods, sandalwood shavings, a dark rose, amber resin — arranged loosely from above",
  "bundle-side":
    "a neat row of small glass perfume decant vials in ascending sizes with minimal black labels on a reflective black surface, shallow depth of field",
};

const TARGETS = [
  ...Object.entries(OPTION_SUBJECTS).map(([id, subject]) => ({
    file: path.join("public", "quiz", `${id}-v2.webp`),
    prompt: optionPrompt(subject),
  })),
  ...Object.entries(WIDGET_SUBJECTS).map(([id, subject]) => ({
    file: path.join("public", `${id}-v2.webp`),
    prompt: widgetPrompt(subject),
  })),
];

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error(
    "Missing OPENAI_API_KEY. Run: OPENAI_API_KEY=sk-... node scripts/gen-quiz-images.mjs",
  );
  process.exit(1);
}

const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function generate(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("response had no data[0].b64_json");
  return Buffer.from(b64, "base64");
}

await mkdir(path.join("public", "quiz"), { recursive: true });

let written = 0;
let skipped = 0;
for (const { file, prompt } of TARGETS) {
  if (await exists(file)) {
    skipped++;
    continue;
  }
  if (written > 0) await sleep(1000);
  const png = await generate(prompt);
  // The API returns PNG (~2-3MB at this size); WebP q85 is visually identical
  // in the small quiz tiles at ~10% of the weight.
  const webp = await sharp(png).webp({ quality: 85 }).toBuffer();
  await writeFile(file, webp);
  written++;
  console.log(`wrote ${file} (${(webp.length / 1024).toFixed(0)}kB)`);
}
console.log(`done — ${written} written, ${skipped} already existed.`);
