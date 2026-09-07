/**
 * Нэг л газраас Postgres-т холбогдоно (migrate.ts, check-search-parity.ts).
 *
 * Supabase-ийн шууд хост (`db.<ref>.supabase.co`) нь ЗӨВХӨН IPv6 — IPv4-тэй
 * сүлжээнээс нэрийг нь ч тайлж чадахгүй. Тиймээс шууд холболт бүтэхгүй бол
 * IPv4-тэй Session pooler руу шилжиж, төслийн бүсийг өөрөө оролдож олно.
 */
import { Client } from "pg";

const SSL = { rejectUnauthorized: false } as const;

/** Common Supabase pooler regions to probe (Session pooler, port 5432, IPv4). */
const REGIONS = [
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-southeast-2",
  "ap-south-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "sa-east-1",
];

function isLocal(u: string) {
  return u.includes("localhost") || u.includes("127.0.0.1");
}

async function tryDirect(url: string): Promise<Client | null> {
  const client = new Client({
    connectionString: url,
    ssl: isLocal(url) ? undefined : SSL,
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    return client;
  } catch {
    await client.end().catch(() => {});
    return null;
  }
}

async function tryPooler(
  url: string,
  verbose: boolean,
): Promise<Client | null> {
  const u = new URL(url);
  const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (!m) return null;
  const ref = m[1];
  const password = decodeURIComponent(u.password);
  const database = u.pathname.replace(/^\//, "") || "postgres";

  const hosts = REGIONS.flatMap((r) => [
    `aws-0-${r}.pooler.supabase.com`,
    `aws-1-${r}.pooler.supabase.com`,
  ]);

  for (const host of hosts) {
    const client = new Client({
      host,
      port: 5432,
      user: `postgres.${ref}`,
      password,
      database,
      ssl: SSL,
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      console.log(`→ Connected via Session pooler (${host}).`);
      return client;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Only surface non-"tenant not found" errors to cut noise.
      if (verbose && !/tenant.*not found/i.test(msg)) {
        console.log(`  ${host}: ${msg}`);
      }
      await client.end().catch(() => {});
    }
  }
  return null;
}

/** Холбогдсон client, эсвэл ойлгомжтой алдаа заагаад гарна. */
export async function connectDb(url: string, verbose = true): Promise<Client> {
  const client = (await tryDirect(url)) ?? (await tryPooler(url, verbose));
  if (!client) {
    console.error(
      "✖ Could not connect via direct host or Session pooler.\n" +
        "  Copy the Session pooler URI from the Supabase dashboard\n" +
        "  (Connect → Session pooler) into DATABASE_URL and retry.",
    );
    process.exit(1);
  }
  return client;
}
