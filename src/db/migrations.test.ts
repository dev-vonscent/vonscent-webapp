import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Migration-ий нэрийн цоож.
 *
 * `scripts/migrate.ts` нь файлуудыг **нэрээр нь** эрэмбэлж ажиллуулдаг.
 * Хоёр файл нэг дугаартай байвал тэдний дараалал нь дугаарын араас ирэх
 * үгнээс шалтгаална — хэн ч зориуд сонгоогүй, хэнд ч харагдахгүй дараалал.
 * Удаан хугацаанд `0028`–`0031`, `0053`, `0054` тус бүр хоёр файлтай байсан;
 * тэдгээр нь одоо `a`/`b` үсгээр ялгагдсан (дараалал нь хэвээр).
 *
 * Энэ тест нь `pnpm test` (тэгэхээр CI) дотор ажилладаг тул давхардсан
 * дугаартай файл PR-аас цааш гарахгүй.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

describe("supabase/migrations", () => {
  it("нэр бүр `NNNN[a-z]_slug.sql` загвартай", () => {
    const bad = files.filter((f) => !/^\d{4}[a-z]?_[a-z0-9_]+\.sql$/u.test(f));
    expect(bad).toEqual([]);
  });

  it("угтвар давхардаагүй", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of files) {
      const prefix = /^\d{4}[a-z]?/u.exec(f)?.[0] ?? f;
      const previous = seen.get(prefix);
      if (previous) clashes.push(`${prefix}: ${previous} + ${f}`);
      else seen.set(prefix, f);
    }
    expect(clashes).toEqual([]);
  });

  it("нэр солигдсон файлууд migrate.ts-ийн RENAMED-д бүртгэлтэй", () => {
    // Нэр солих нь `_app_migrations`-ийн түлхүүрийг өөрчилдөг: хүснэгтэд
    // бүртгэгдээгүй бол ажилласан сан дээр migration ДАХИН ажиллана.
    const script = readFileSync(
      join(process.cwd(), "scripts", "migrate.ts"),
      "utf8",
    );
    const map = script.slice(
      script.indexOf("const RENAMED"),
      script.indexOf("const byNumber"),
    );
    // Үсэгтэй нэр = нүүлгэсэн файл. Шинээр нүүлгэвэл энд автоматаар барина.
    const moved = files.filter((f) => /^\d{4}[a-z]_/u.test(f));
    expect(moved.length).toBeGreaterThan(0);
    for (const current of moved) expect(map).toContain(`"${current}"`);
  });
});
