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

const MODEL = "gpt-image-1"; // the team may switch this to a newer image model
const SIZE = "1024x1536";
const QUALITY = "high";

const prompt = (subject) =>
  `Dark moody luxury fragrance editorial photograph, ${subject}, deep black background, dramatic low-key studio lighting with a faint warm golden glow from one side, monochrome with subtle warm accents, generous negative space, premium fragrance advertisement aesthetic, cinematic, vertical composition.`;

/** Quiz option tiles → public/quiz/{id}.png. Gender and season questions
 *  reuse existing cards (public/gender-*.png, public/season-*.jpg). */
const OPTION_SUBJECTS = {
  "weekend-beach": "sunlit ocean waves rolling onto dark wet sand, seen from above",
  "weekend-forest": "a misty dark pine forest path with rays of light between the trees",
  "weekend-cozy": "a lit candle beside an open book on dark linen sheets",
  "weekend-garden": "night-blooming white flowers in a dark garden at dusk",
  "time-morning": "soft dawn light breaking through fog over dark hills",
  "time-noon": "a bright beam of sunlight falling on fresh citrus slices",
  "time-sunset": "a warm golden sunset horizon fading into darkness",
  "time-night": "a crescent moon reflected on dark rippled glass",
  "character-energetic": "a frozen splash of clear water with citrus zest bursting through it",
  "character-romantic": "a single dark red rose with dew drops on its petals",
  "character-warm": "glowing embers with cinnamon sticks and star anise",
  "character-calm": "smooth dark river stones stacked in perfect balance",
  "impression-whisper": "a barely visible wisp of perfume mist dissolving into darkness",
  "impression-balanced": "a fine even veil of mist hanging in calm soft light",
  "impression-bold": "dense swirling perfume mist caught in a dramatic beam of light",
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
    file: path.join("public", "quiz", `${id}.png`),
    subject,
  })),
  ...Object.entries(WIDGET_SUBJECTS).map(([id, subject]) => ({
    file: path.join("public", `${id}.png`),
    subject,
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

async function generate(subject) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt(subject),
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
for (const { file, subject } of TARGETS) {
  if (await exists(file)) {
    skipped++;
    continue;
  }
  if (written > 0) await sleep(1000);
  const png = await generate(subject);
  await writeFile(file, png);
  written++;
  console.log(`wrote ${file} (${(png.length / 1024).toFixed(0)}kB)`);
}
console.log(`done — ${written} written, ${skipped} already existed.`);
