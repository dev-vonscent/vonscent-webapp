/**
 * `pnpm dev` (dev Supabase) ба `pnpm dev:local` (локал Supabase, Docker).
 *
 * `--local`: `.env.localdb`-ийг process.env-д ачаална. Next нь process.env-д
 * байгаа түлхүүрийг .env.local (.env.dev)-ээр дардаггүй тул DB, QPay mock,
 * унтраасан Telegram/Resend нь локалынх; бусад тохиргоо .env.local-аас.
 *
 * Сан солигдоход `fetch-cache`-ийг устгана: `unstable_cache` (туг, каталог,
 * нүүрний хэсэг) нь tag-аар л шинэчлэгддэг тул өмнөх сангийн өгөгдөл
 * үлдэж, жишээ нь локалд хаалттай тугийн цэс харагдана.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const local = args.includes("--local");
const nextArgs = args.filter((a) => a !== "--local");
if (local) process.loadEnvFile(".env.localdb");

const target = local ? "local" : "dev";
const marker = ".next/.db-target";
const previous = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
if (previous !== target) {
  for (const dir of [".next/cache/fetch-cache", ".next/dev/cache/fetch-cache"]) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (previous) console.log(`• Сан солигдсон (${previous} → ${target}): data cache цэвэрлэв.`);
}
mkdirSync(".next", { recursive: true });
writeFileSync(marker, target);

const child = spawn("next", ["dev", ...nextArgs], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
