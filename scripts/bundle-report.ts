/**
 * Bundle-ийн хэмжээг хэмжих (backlog H2 / §2.6).
 *
 *   pnpm analyze
 *
 * `next build --experimental-analyze` нь Turbopack-ийн build статистикийг
 * `.next/diagnostics/` дотор үлдээдэг. Гуравдагч analyzer нэмэх шаардлагагүй —
 * `@next/bundle-analyzer` нь webpack дээр л ажилладаг тул Next 16-ийн Turbopack
 * build дээр ЧИМЭЭГҮЙ юу ч хийхгүй өнгөрдөг.
 *
 * Энэ скрипт тэр JSON-оос маршрут бүрийн «эхний ачаалалт»-ын JS-ийг уншиж
 * жагсаана. Тоо нь ШАХААГҮЙ (uncompressed) байт — сүлжээгээр явах хэмжээ биш,
 * браузарын задлан шинжлэх ажлын хэмжүүр.
 *
 * Дэлгэрэнгүй treemap: `.next/diagnostics/analyze/` доторх HTML-ийг нээнэ.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface RouteStat {
  route: string;
  firstLoadUncompressedJsBytes: number;
  firstLoadChunkPaths: string[];
}

const STATS = join(
  process.cwd(),
  ".next",
  "diagnostics",
  "route-bundle-stats.json",
);

/** Хэдэн мөрийг нэрлэн харуулах вэ (үлдсэнийг нь нэг мөрөнд хураана). */
const TOP = 15;

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024).toLocaleString("mn-MN")} KB`;
}

let stats: RouteStat[];
try {
  stats = JSON.parse(readFileSync(STATS, "utf8")) as RouteStat[];
} catch {
  console.error(
    `✖ ${STATS} олдсонгүй.\n  Эхлээд: pnpm analyze (эсвэл next build --experimental-analyze)`,
  );
  process.exit(1);
}

// API маршрут нь client bundle-гүй — жагсаалтыг дүүргэхээс өөр юу ч хэлэхгүй.
const pages = stats
  .filter((r) => !r.route.startsWith("/api/"))
  .sort(
    (a, b) => b.firstLoadUncompressedJsBytes - a.firstLoadUncompressedJsBytes,
  );

if (!pages.length) {
  console.log("Маршрут олдсонгүй.");
  process.exit(0);
}

// Бүх маршрутад ордог chunk-ууд = нийтлэг суурь. Хамгийн том маршрут ч үүнээс
// доош буухгүй тул тусад нь хэлэх нь зөв: 1.6MB-ийн 1.4 нь суурь бол тухайн
// хуудсыг оптимизаци хийгээд нэмэргүй.
const shared = pages
  .map((r) => new Set(r.firstLoadChunkPaths))
  .reduce((acc, set) => new Set([...acc].filter((c) => set.has(c))));

const width = Math.max(...pages.slice(0, TOP).map((r) => r.route.length));
console.log(`\nЭхний ачаалалтын JS (шахаагүй) — ${pages.length} маршрут\n`);
for (const r of pages.slice(0, TOP)) {
  console.log(
    `  ${r.route.padEnd(width)}  ${kb(r.firstLoadUncompressedJsBytes).padStart(10)}`,
  );
}
if (pages.length > TOP) {
  const rest = pages.slice(TOP);
  const min = rest[rest.length - 1].firstLoadUncompressedJsBytes;
  const max = rest[0].firstLoadUncompressedJsBytes;
  console.log(`  … бусад ${rest.length} маршрут: ${kb(min)} – ${kb(max)}`);
}
console.log(`\n  Бүх маршрутад нийтлэг: ${shared.size} chunk`);
console.log(`  Дэлгэрэнгүй: .next/diagnostics/analyze/\n`);
