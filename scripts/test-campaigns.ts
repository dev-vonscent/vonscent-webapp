/**
 * Кампанит ажлын RPC-ийн integration тест (0135_campaigns) — бодит Postgres.
 *
 *   pnpm db:test-campaigns-dev      # зөвхөн .env.dev
 *
 * Сан бохирдуулахгүй: сценари бүр `begin … rollback` дотор явна (тугийн
 * утгыг ч транзакц дотор сольж, буцаана).
 *
 * Купоныг зэрэг ашиглах (row lock) нь `db:test-coupons-dev`-д шалгагдсан:
 * кампанит купон бол энгийн хувийн купон (`max_uses = 1`) тул тэр тест хамарна.
 */
import type { Client } from "pg";
import { connectDb } from "./db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set (use --env-file=.env.dev).");
  process.exit(1);
}

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✖ ${name}`, detail ?? "");
  }
}

async function scenario(
  c: Client,
  name: string,
  body: () => Promise<void>,
): Promise<void> {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    // Dev санд админы жинхэнэ кампанит ажил байж болно — давхцал үүсгэж,
    // купон олгож тестийг бохирдуулахгүйн тулд транзакц дотор түр унтраана.
    await c.query("update campaigns set is_active = false where is_active");
    await body();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа", e);
  } finally {
    await c.query("rollback");
  }
}

const UB_TODAY = `(now() at time zone 'Asia/Ulaanbaatar')::date`;

async function setFlag(c: Client, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ('campaigns', $1)
       on conflict (key) do update set enabled = excluded.enabled`,
    [on],
  );
}

async function addCampaign(
  c: Client,
  opts: {
    name?: string;
    active?: boolean;
    from?: string;
    to?: string;
    perUser?: number;
  } = {},
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into campaigns (type, name, is_active, starts_on, ends_on,
                            coupon_value, min_subtotal, coupon_valid_days,
                            coupons_per_user)
     values ('signup_coupon', $1, $2, ${opts.from ?? UB_TODAY},
             ${opts.to ?? `${UB_TODAY} + 30`}, 5000, 30000, 7, $3)
     returning id`,
    [opts.name ?? "Тест", opts.active ?? true, opts.perUser ?? 1],
  );
  return rows[0].id;
}

async function grant(c: Client, user: string, phone: string | null) {
  const { rows } = await c.query<{ r: unknown }>(
    "select grant_signup_coupons($1, $2) as r",
    [user, phone],
  );
  return rows[0].r as { count: number; value: number } | null;
}

async function couponsOf(c: Client, user: string) {
  const { rows } = await c.query<{
    value: number;
    min_subtotal: number;
    max_uses: number;
    max_uses_per_user: number;
    source: string;
    ends_ub: string;
  }>(
    `select value, min_subtotal, max_uses, max_uses_per_user, source,
            to_char(ends_at at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD HH24:MI:SS') as ends_ub
       from coupons where user_id = $1 and source = 'campaign'`,
    [user],
  );
  return rows;
}

async function main() {
  const c = await connectDb(url!);
  const users = await c.query<{ id: string }>(
    `select u.id from auth.users u join profiles p on p.id = u.id
      where p.role = 'customer' order by u.created_at limit 2`,
  );
  if (users.rows.length < 2) throw new Error("Dev санд 2 хэрэглэгч хэрэгтэй.");
  const [u1, u2] = users.rows.map((r) => r.id);
  const phone = "99000135";

  await scenario(c, "Туг хаалттай — юу ч үүсэхгүй", async () => {
    await setFlag(c, false);
    await addCampaign(c);
    const grants = async () =>
      Number(
        (
          await c.query<{ n: string }>(
            "select count(*) as n from campaign_grants",
          )
        ).rows[0].n,
      );
    const before = await grants();
    check("RPC null буцаана", (await grant(c, u1, phone)) === null);
    const after = await grants();
    check("campaign_grants нэмэгдээгүй", after === before, { before, after });
    check("купон үүсээгүй", (await couponsOf(c, u1)).length === 0);
  });

  await scenario(c, "Идэвхтэй кампанит ажил — купон олгоно", async () => {
    await setFlag(c, true);
    await addCampaign(c, { perUser: 2 });
    const r = await grant(c, u1, phone);
    check("2 купон олгосон", r?.count === 2, r);
    const rows = await couponsOf(c, u1);
    check("эзэмшигчид 2 купон", rows.length === 2, rows.length);
    const { rows: exp } = await c.query<{ d: string }>(
      `select to_char(${UB_TODAY} + 6, 'YYYY-MM-DD') || ' 23:59:59' as d`,
    );
    check(
      "хүчинтэй: олгосон өдрийг оролцуулан 7 хоног (+6 дахь өдрийн 23:59:59, UB)",
      rows.every((x) => x.ends_ub === exp[0].d),
      rows.map((x) => x.ends_ub),
    );
    check(
      "нэг удаагийн хувийн купон, 5,000₮, доод 30,000₮",
      rows.every(
        (x) =>
          x.value === 5000 &&
          x.min_subtotal === 30000 &&
          x.max_uses === 1 &&
          x.max_uses_per_user === 1,
      ),
      rows,
    );
    check("дахин дуудахад олгохгүй", (await grant(c, u1, phone)) === null);
    check(
      "ижил утсаар өөр бүртгэлд олгохгүй",
      (await grant(c, u2, phone)) === null,
    );
    check(
      "өөр утастай хэрэглэгчид олгоно",
      (await grant(c, u2, "99000136"))?.count === 2,
    );
  });

  await scenario(c, "Хугацааны хил", async () => {
    await setFlag(c, true);
    await addCampaign(c, { from: `${UB_TODAY} + 1`, to: `${UB_TODAY} + 5` });
    check("маргааш эхлэх — олгохгүй", (await grant(c, u1, null)) === null);
  });

  await scenario(c, "Дууссан кампанит ажил", async () => {
    await setFlag(c, true);
    await addCampaign(c, { from: `${UB_TODAY} - 10`, to: `${UB_TODAY} - 1` });
    check("өчигдөр дууссан — олгохгүй", (await grant(c, u1, null)) === null);
  });

  await scenario(c, "Өнөөдөр дуусах (23:59:59 хүртэл)", async () => {
    await setFlag(c, true);
    await addCampaign(c, { from: `${UB_TODAY} - 10`, to: UB_TODAY });
    check("өнөөдөр олгоно", (await grant(c, u1, null))?.count === 1);
  });

  await scenario(c, "Унтраалттай кампанит ажил", async () => {
    await setFlag(c, true);
    await addCampaign(c, { active: false });
    check("олгохгүй", (await grant(c, u1, null)) === null);
  });

  await scenario(c, "Давхцал хориглогдоно", async () => {
    await addCampaign(c, { name: "Эхнийх" });
    let error = "";
    try {
      await c.query("savepoint s");
      await addCampaign(c, { name: "Хоёр дахь" });
    } catch (e) {
      error = (e as Error).message;
      await c.query("rollback to savepoint s");
    }
    check(
      "идэвхтэй давхцал → CAMPAIGN_OVERLAP:Эхнийх",
      error.includes("CAMPAIGN_OVERLAP:Эхнийх"),
      error,
    );
    await addCampaign(c, { name: "Унтраалттай", active: false });
    check("унтраалттай давхцлыг зөвшөөрнө", true);
    await addCampaign(c, {
      name: "Дараагийнх",
      from: `${UB_TODAY} + 31`,
      to: `${UB_TODAY} + 60`,
    });
    check("залгаа хугацааг зөвшөөрнө", true);
  });

  await scenario(c, "Эрх: anon/authenticated дуудаж чадахгүй", async () => {
    const { rows } = await c.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'grant_signup_coupons(uuid, text)', 'execute') as anon,
              has_function_privilege('authenticated', 'grant_signup_coupons(uuid, text)', 'execute') as auth`,
    );
    check("anon эрхгүй", rows[0].anon === false);
    check("authenticated эрхгүй", rows[0].auth === false);
  });

  await c.end();
  console.log(failed === 0 ? "\n✅ Бүгд амжилттай." : `\n✖ ${failed} алдаа.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
