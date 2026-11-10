/**
 * `pnpm dev:local` — Next.js-ийг локал Supabase (pnpm db:local start) руу.
 *
 * `.env.localdb`-ийг process.env-д ачаалаад `next dev` асаана. Next нь
 * process.env-д аль хэдийн байгаа түлхүүрийг .env.local (.env.dev)-ээр
 * дардаггүй тул DB/Supabase, QPay mock, унтраасан Telegram/Resend нь
 * локалынх болно; бусад тохиргоо .env.local-аас.
 * (`node --env-file` нь NODE_OPTIONS-оор дэд процесст дамждаггүй.)
 */
import { spawn } from "node:child_process";

process.loadEnvFile(".env.localdb");
const child = spawn("next", ["dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
