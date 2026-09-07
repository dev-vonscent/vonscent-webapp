/**
 * Apply SQL migrations in supabase/migrations/* to the database in DATABASE_URL.
 *
 *   node --env-file=.env.local --import tsx scripts/migrate.ts
 *
 * Migrations are idempotent (if-not-exists / duplicate-object guards), so this
 * is safe to re-run. Each file runs in its own transaction, in filename order.
 *
 * Supabase's direct host (db.<ref>.supabase.co) is IPv6-only; if it can't be
 * resolved we transparently fall back to the IPv4 Session pooler (scripts/db.ts).
 */
import { connectDb } from "./db";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.local).");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function main() {
  const client = await connectDb(url!);

  // Track which migrations have run so re-runs only apply new ones.
  await client.query(
    `create table if not exists _app_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const appliedRes = await client.query<{ name: string }>(
    "select name from _app_migrations",
  );
  const applied = new Set(appliedRes.rows.map((r) => r.name));

  // SQLSTATEs that mean "object already exists" — treat as already-applied
  // (covers triggers/policies from a prior partial run without tracking).
  const DUP_CODES = new Set([
    "42710",
    "42P07",
    "42P06",
    "42723",
    "42701",
    "42P04",
    "42P16",
  ]);

  console.log(`${applied.size} already applied. Checking ${files.length}…\n`);
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• ${file} (skipped)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into _app_migrations(name) values ($1) on conflict do nothing",
        [file],
      );
      await client.query("commit");
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (DUP_CODES.has(code)) {
        await client.query(
          "insert into _app_migrations(name) values ($1) on conflict do nothing",
          [file],
        );
        console.log(`• ${file} (already applied)`);
        continue;
      }
      console.error(`✖ ${file}`);
      console.error(`  ${err instanceof Error ? err.message : String(err)}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✅ All migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
