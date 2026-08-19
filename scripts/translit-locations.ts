/**
 * Rebuild `nameEn` in src/lib/geo/mn-locations.json from the Cyrillic `name`.
 *
 *   node --import tsx scripts/translit-locations.ts            # dry run (diff)
 *   node --import tsx scripts/translit-locations.ts --write    # apply
 *
 * The HDX source ships a machine transliteration that spells х as "x", ө as
 * "o'" and ц as "c" — "Songinoxairxan", "Bayanzu'rx", "Altanco'gc". Patching
 * that Latin in place is unsafe (a blind c→ts would turn "ch" into "tsh"), so
 * this regenerates every value from the Cyrillic instead. Re-run it whenever
 * mn-locations.json is refreshed from HDX.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { translit } from "../src/lib/geo/translit";

interface Adm {
  code: string;
  name: string;
  nameEn: string;
  children?: Adm[];
}

const file = join(process.cwd(), "src/lib/geo/mn-locations.json");
const data = JSON.parse(readFileSync(file, "utf8")) as {
  aimags: Adm[];
} & Record<string, unknown>;

const changes: [string, string, string, string][] = [];
let total = 0;

for (const aimag of data.aimags) {
  for (const node of [aimag, ...(aimag.children ?? [])]) {
    total++;
    const next = translit(node.name);
    if (next !== node.nameEn) {
      changes.push([node.code, node.name, node.nameEn, next]);
      node.nameEn = next;
    }
  }
}

console.log(`${changes.length} / ${total} nameEn өөрчлөгдөнө\n`);
console.log(
  `${"код".padEnd(8)}${"кирилл".padEnd(20)}${"хуучин".padEnd(22)}шинэ`,
);
for (const [code, mn, before, after] of changes) {
  console.log(`${code.padEnd(8)}${mn.padEnd(20)}${before.padEnd(22)}${after}`);
}

if (process.argv.includes("--write")) {
  // Match the file's existing 2-space formatting so the diff stays readable.
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`\n✓ ${file}`);
} else {
  console.log("\n(dry run — хэрэглэхийн тулд --write нэмнэ үү)");
}
