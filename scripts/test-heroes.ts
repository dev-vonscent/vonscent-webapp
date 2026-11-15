/**
 * Нүүрний hero (0182_heroes, 0183 AI зураг) integration тест — бодит Postgres.
 *
 *   pnpm db:test-heroes-dev      # зөвхөн .env.dev
 *
 * docs/campaigns/plan.md §7.2, §11, §12; studio-ux.md §11 (0185 улирлын баннер).
 * Сценари бүр `begin … rollback`.
 */
import type { Client } from "pg";
import { seasonHeroAt, type SeasonRowLike } from "../src/features/heroes/season";
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

async function setFlag(c: Client, key: string, on: boolean) {
  await c.query(
    `insert into feature_flags (key, enabled) values ($1, $2)
       on conflict (key) do update set enabled = excluded.enabled`,
    [key, on],
  );
}

async function scenario(c: Client, name: string, body: () => Promise<void>) {
  console.log(`\n${name}`);
  await c.query("begin");
  try {
    await setFlag(c, "hero_admin", true);
    await setFlag(c, "sale_events", true);
    // Dev санд жинхэнэ hero / арга хэмжээ байж болно — түр унтраана.
    await c.query("update heroes set is_active = false where is_active");
    await c.query("update sale_events set is_active = false where is_active");
    await body();
  } catch (e) {
    failed++;
    console.log("  ✖ алдаа", e);
  } finally {
    await c.query("rollback");
  }
}

async function errorOf(c: Client, sql: string, params: unknown[] = []) {
  await c.query("savepoint t");
  try {
    await c.query(sql, params);
    await c.query("release savepoint t");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint t");
    return e as Error;
  }
}

const IMG = {
  desktop: { base: "https://x/hero/a/b", widths: [1600, 2400, 3200], height1600: 571 },
  mobile: { src: "https://x/hero/a/m.webp", width: 1600, height: 1200 },
};

async function addHero(
  c: Client,
  o: {
    name?: string;
    from?: string;
    to?: string;
    event?: string | null;
    priority?: number;
    active?: boolean;
    images?: boolean;
    primary?: object;
  } = {},
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into heroes (name, sale_event_id, starts_at, ends_at, priority, is_active,
                         title, primary_label, primary_target, desktop_image, mobile_image)
     values ($1, $2, ${o.event ? "null" : (o.from ?? "now() - interval '1 hour'")},
             ${o.event ? "null" : (o.to ?? "now() + interval '1 hour'")},
             $3, $4, 'Гарчиг', 'Үзэх', $5::jsonb, $6::jsonb, $7::jsonb)
     returning id`,
    [
      o.name ?? "H",
      o.event ?? null,
      o.priority ?? 0,
      o.active ?? true,
      JSON.stringify(o.primary ?? { type: "path", href: "/catalog" }),
      o.images === false ? null : JSON.stringify(IMG.desktop),
      o.images === false ? null : JSON.stringify(IMG.mobile),
    ],
  );
  return rows[0].id;
}

async function addEvent(
  c: Client,
  slug: string,
  from = "now() - interval '1 hour'",
  to = "now() + interval '1 hour'",
  active = true,
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into sale_events (slug, name, starts_at, ends_at, is_active)
     values ($1, $1, ${from}, ${to}, $2) returning id`,
    [slug, active],
  );
  return rows[0].id;
}

async function liveId(c: Client): Promise<string | null> {
  const { rows } = await c.query<{ id: string }>("select id from live_hero()");
  return rows[0]?.id ?? null;
}

async function main() {
  const c = await connectDb(url!);

  await scenario(c, "1. Туг хаалттай — хоосон, бичилт хориотой", async () => {
    await addHero(c);
    await setFlag(c, "hero_admin", false);
    check("live_hero хоосон", (await liveId(c)) === null);
    const err = await errorOf(
      c,
      `insert into heroes (name, starts_at, ends_at, title, primary_label, primary_target)
       values ('x', now(), now() + interval '1 day', 't', 'b', '{"type":"path","href":"/"}')`,
    );
    check("insert → FEATURE_DISABLED", /FEATURE_DISABLED/.test(err?.message ?? ""), err?.message);
  });

  await scenario(c, "2. Хуваарь ба эрэмбэ", async () => {
    check("hero байхгүй → хоосон (кодын hero)", (await liveId(c)) === null);
    const a = await addHero(c, { name: "A" });
    check("явж буй → гарна", (await liveId(c)) === a);
    await addHero(c, { name: "future", from: "now() + interval '1 hour'", to: "now() + interval '2 hours'", priority: 50 });
    check("эхлээгүй (их эрэмбэтэй ч) → гарахгүй", (await liveId(c)) === a);
    const b = await addHero(c, { name: "B", priority: 10 });
    check("их эрэмбэ түрүүлнэ", (await liveId(c)) === b);
    await addHero(c, { name: "ended", from: "now() - interval '2 hours'", to: "now()", priority: 99 });
    check("дууссан (ends_at exclusive) → гарахгүй", (await liveId(c)) === b);
    await addHero(c, { name: "draft", active: false, priority: 99 });
    check("ноорог → гарахгүй", (await liveId(c)) === b);
  });

  await scenario(c, "3. Зураггүй hero идэвхтэй болохгүй", async () => {
    const err = await errorOf(
      c,
      `insert into heroes (name, starts_at, ends_at, is_active, title, primary_label, primary_target)
       values ('x', now(), now() + interval '1 day', true, 't', 'b', '{"type":"path","href":"/"}')`,
    );
    check("heroes_active_images", /heroes_active_images/.test(err?.message ?? ""), err?.message);
    const draft = await addHero(c, { active: false, images: false });
    check("зураггүй ноорог болно", Boolean(draft));
  });

  await scenario(c, "4. Арга хэмжээтэй холбоо", async () => {
    const ev = await addEvent(c, "hero-bf", "now() + interval '1 hour'", "now() + interval '2 hours'");
    const h = await addHero(c, { event: ev });
    check("арга хэмжээ эхлээгүй → гарахгүй", (await liveId(c)) === null);
    await c.query("update sale_events set starts_at = now() - interval '1 hour' where id = $1", [ev]);
    check("арга хэмжээ эхлэхэд → гарна", (await liveId(c)) === h);
    const { rows } = await c.query("select ends_at from live_hero()");
    const e = await c.query("select ends_at from sale_events where id = $1", [ev]);
    check("хугацаа арга хэмжээнээс", String(rows[0].ends_at) === String(e.rows[0].ends_at));
    await c.query("update sale_events set is_active = false where id = $1", [ev]);
    check("арга хэмжээ цуцлагдвал → унтарна", (await liveId(c)) === null);
    await c.query("update sale_events set is_active = true where id = $1", [ev]);
    await setFlag(c, "sale_events", false);
    check("sale_events туг хаалттай → холбоотой hero гарахгүй", (await liveId(c)) === null);
    await setFlag(c, "sale_events", true);
    await c.query("delete from sale_events where id = $1", [ev]);
    const after = await c.query(
      "select sale_event_id, is_active, starts_at, ends_at from heroes where id = $1",
      [h],
    );
    check("арга хэмжээ устгахад hero үлдэнэ (set null)", after.rows[0].sale_event_id === null);
    check("хугацаа хуулагдаж, ноорог болно", after.rows[0].is_active === false && after.rows[0].ends_at != null, after.rows[0]);
  });

  await scenario(c, "5. Товч live биш арга хэмжээ рүү заавал алгасна", async () => {
    await addEvent(c, "btn-ev", "now() + interval '1 hour'", "now() + interval '2 hours'");
    await addHero(c, { primary: { type: "event", slug: "btn-ev" }, priority: 5 });
    const fallback = await addHero(c, { name: "fallback" });
    check("эвдэрсэн товчтой hero алгасагдана", (await liveId(c)) === fallback);
    const ok = await addHero(c, { primary: { type: "season", value: "winter" }, priority: 9 });
    check("улирлын холбоос → гарна", (await liveId(c)) === ok);
  });

  await scenario(c, "6. Холбоосын хамгаалалт (hero_target_valid)", async () => {
    const bad = [
      { type: "path", href: "https://evil.example" },
      { type: "path", href: "//evil.example" },
      { type: "path", href: "/\\evil.example" },
      { type: "path", href: "/a b" },
      { type: "season", value: "all" },
      { type: "event", slug: "Bad Slug" },
      { type: "nope" },
    ];
    for (const t of bad) {
      const err = await errorOf(
        c,
        `insert into heroes (name, starts_at, ends_at, title, primary_label, primary_target)
         values ('x', now(), now() + interval '1 day', 't', 'b', $1::jsonb)`,
        [JSON.stringify(t)],
      );
      check(`татгалзана: ${JSON.stringify(t)}`, /check constraint/.test(err?.message ?? ""), err?.message);
    }
    const good = await errorOf(
      c,
      `insert into heroes (name, starts_at, ends_at, title, primary_label, primary_target)
       values ('x', now(), now() + interval '1 day', 't', 'b', '{"type":"path","href":"/collections/build"}')`,
    );
    check("дотоод хаяг зөвшөөрөгдөнө", good === null, good?.message);
  });

  await scenario(c, "7. Эрх (anon)", async () => {
    await addHero(c, { name: "visible" });
    await addHero(c, { name: "sched", from: "now() + interval '5 hours'", to: "now() + interval '6 hours'" });
    await c.query("set local role anon");
    const t = await c.query("select * from heroes");
    check("heroes шууд select → 0 мөр", t.rowCount === 0);
    const l = await c.query("select * from live_hero()");
    check("live_hero нэг мөр, нэр/эрэмбэ ил гарахгүй", l.rowCount === 1 && !("name" in l.rows[0]) && !("priority" in l.rows[0]), l.rows[0]);
    const w = await errorOf(
      c,
      `insert into heroes (name, starts_at, ends_at, title, primary_label, primary_target)
       values ('x', now(), now() + interval '1 day', 't', 'b', '{"type":"path","href":"/"}')`,
    );
    check("anon бичиж чадахгүй", w !== null, w?.message);
    await c.query("reset role");
  });

  await scenario(c, "8. AI зургийн ажил (0183)", async () => {
    const insert = () =>
      errorOf(
        c,
        `insert into hero_image_generations (group_id, target, theme_key, size, prompt)
         values (gen_random_uuid(), 'desktop', 'winter', '3584x1280', 'p')`,
      );
    check("туг нээлттэй → insert болно", (await insert()) === null);
    const bad = await errorOf(
      c,
      `insert into hero_image_generations (group_id, target, theme_key, size, prompt)
       values (gen_random_uuid(), 'tablet', 'winter', '3584x1280', 'p')`,
    );
    check("target зөвхөн desktop/mobile", /check constraint/.test(bad?.message ?? ""), bad?.message);
    const four = await errorOf(
      c,
      `insert into hero_image_generations (group_id, target, theme_key, size, prompt, product_ids)
       values (gen_random_uuid(), 'desktop', 'winter', '3584x1280', 'p',
               array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()])`,
    );
    check("үнэртэн ихдээ 3", /hig_product_count/.test(four?.message ?? ""), four?.message);
    await c.query("set local role anon");
    const r = await c.query("select * from hero_image_generations");
    check("anon уншихгүй", r.rowCount === 0);
    await c.query("reset role");
    await setFlag(c, "hero_admin", false);
    const off = await insert();
    check("туг хаалттай → FEATURE_DISABLED (зардал гарахгүй)", /FEATURE_DISABLED/.test(off?.message ?? ""), off?.message);
  });

  await scenario(c, "9. live_heroes() (0184) — кэшийн жагсаалт", async () => {
    const low = await addHero(c, { name: "winter", priority: 1 });
    const high = await addHero(c, { name: "bf", priority: 10 });
    await addHero(c, { name: "draft", priority: 50, active: false });
    const { rows } = await c.query<{ id: string }>("select id from live_heroes()");
    check(
      "priority-ийн дарааллаар 2 мөр",
      rows.length === 2 && rows[0].id === high && rows[1].id === low,
      rows,
    );
    check("эхнийх нь live_hero()-тэй таарна", (await liveId(c)) === rows[0].id);
    // Товлосон арга хэмжээ рүү заасан hero ороогүй (TS heroTargetBlock-тэй ижил).
    await addEvent(c, "lh-sched", "now() + interval '1 day'", "now() + interval '2 days'");
    const blocked = await addHero(c, { primary: { type: "event", slug: "lh-sched" }, priority: 99 });
    const r2 = await c.query<{ id: string }>("select id from live_heroes()");
    check("товлосон арга хэмжээ рүү заасан hero → жагсаалтад алга", !r2.rows.some((r) => r.id === blocked));
    await c.query("set local role anon");
    const a = await c.query("select * from live_heroes()");
    check("anon дуудаж чадна", a.rowCount === 2);
    await c.query("reset role");
    await setFlag(c, "hero_admin", false);
    const off = await c.query("select * from live_heroes()");
    check("туг хаалттай → хоосон", off.rowCount === 0);
  });

  await scenario(c, "10. Улирлын баннер (0185) — SQL ↔ TS seasonHeroAt", async () => {
    // Дев санд жинхэнэ улирлын мөр байж болно — энэ транзакцид устгана.
    await c.query("delete from heroes where season is not null");
    const ids: Record<string, string> = {};
    const add = async (season: string, md: string, active = true, images = true) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into heroes (name, season, season_start_md, is_active, title, primary_label,
                             primary_target, desktop_image, mobile_image)
         values ($1, $1, $2, $3, 'Гарчиг', 'Үзэх', '{"type":"season","value":"winter"}',
                 $4::jsonb, $5::jsonb) returning id`,
        [season, md, active, images ? JSON.stringify(IMG.desktop) : null, images ? JSON.stringify(IMG.mobile) : null],
      );
      ids[season] = rows[0].id;
      return rows[0].id;
    };
    const compare = async (label: string, rows: SeasonRowLike[], days: string[]) => {
      for (const d of days) {
        const t = Date.parse(`${d}T12:00:00+08:00`);
        const sql = await c.query<{ id: string; starts_at: Date; ends_at: Date }>(
          "select * from season_hero_at($1)",
          [new Date(t).toISOString()],
        );
        const ts = seasonHeroAt(rows, t);
        const a = sql.rows[0];
        const same = !a
          ? ts === null
          : ts !== null &&
            a.id === ts.row.id &&
            a.starts_at.toISOString() === ts.startsAt &&
            a.ends_at.toISOString() === ts.endsAt;
        check(`${label} ${d}`, same, { sql: a, ts });
      }
    };
    const days = ["2026-01-15", "2026-02-28", "2026-03-01", "2026-05-31", "2026-06-01", "2026-09-01", "2026-11-30", "2026-12-01", "2026-12-31"];
    const rowsOf = (spec: [string, string, boolean, boolean][]): SeasonRowLike[] =>
      spec.map(([season, md, active, images]) => ({
        id: ids[season],
        season: season as SeasonRowLike["season"],
        seasonStartMd: md,
        isActive: active,
        desktopImage: images ? IMG.desktop : null,
        mobileImage: images ? IMG.mobile : null,
      }));

    check("нэг ч улирал алга → хоосон", (await c.query("select * from season_hero_at(now())")).rowCount === 0);
    await add("winter", "12-01");
    await compare("ганц Өвөл", rowsOf([["winter", "12-01", true, true]]), days);
    await add("autumn", "09-01");
    await add("spring", "03-01", false, false); // зураггүй ноорог
    await add("summer", "06-01");
    const spec: [string, string, boolean, boolean][] = [
      ["winter", "12-01", true, true],
      ["autumn", "09-01", true, true],
      ["spring", "03-01", false, false],
      ["summer", "06-01", true, true],
    ];
    await compare("Хавар зураггүй", rowsOf(spec), days);
    await c.query("update heroes set desktop_image = $1::jsonb, mobile_image = $2::jsonb, is_active = true where id = $3",
      [JSON.stringify(IMG.desktop), JSON.stringify(IMG.mobile), ids.spring]);
    await c.query("update heroes set season_start_md = '11-15' where id = $1", [ids.winter]);
    spec[0][1] = "11-15";
    spec[2][2] = true;
    spec[2][3] = true;
    await compare("4 улирал, Өвөл 11/15", rowsOf(spec), [...days, "2026-11-14", "2026-11-15"]);

    // live_heroes: тусгай өдөр эхэнд, улирал ард.
    const special = await addHero(c, { name: "special" });
    const lh = await c.query<{ id: string }>("select id from live_heroes()");
    check("тусгай өдөр эхэнд, улирал ард", lh.rows[0]?.id === special && lh.rows.length === 2, lh.rows);
    await c.query("update heroes set is_active = false where id = $1", [special]);
    const cur = await c.query<{ id: string }>("select id from season_hero_at(now())");
    check("тусгай өдөргүй → live_hero = улирал", (await liveId(c)) === cur.rows[0]?.id);
    const lr = await c.query<{ starts_at: Date; ends_at: Date }>("select starts_at, ends_at from live_heroes()");
    check("улирлын мөрөнд тооцоолсон хугацаа", lr.rows[0]?.starts_at < new Date() && new Date() < lr.rows[0]?.ends_at, lr.rows[0]);

    // Хязгаарлалт
    const dup = await errorOf(c, `insert into heroes (name, season, season_start_md, title, primary_label, primary_target)
      values ('x', 'winter', '01-10', 't', 'b', '{"type":"path","href":"/"}')`);
    check("улирал давхардахгүй", /heroes_season_uniq/.test(dup?.message ?? ""), dup?.message);
    await c.query("delete from heroes where id = $1", [ids.summer]);
    const leap = await errorOf(c, `insert into heroes (name, season, season_start_md, title, primary_label, primary_target)
      values ('x', 'summer', '02-29', 't', 'b', '{"type":"path","href":"/"}')`);
    check("02-29 татгалзана", /heroes_season_start_md_valid/.test(leap?.message ?? ""), leap?.message);
    const dated = await errorOf(c, `insert into heroes (name, season, season_start_md, starts_at, ends_at, title, primary_label, primary_target)
      values ('x', 'summer', '06-01', now(), now() + interval '1 day', 't', 'b', '{"type":"path","href":"/"}')`);
    check("улирлын мөр огноогүй", /heroes_season_solo/.test(dated?.message ?? ""), dated?.message);
    const pair = await errorOf(c, `insert into heroes (name, season, title, primary_label, primary_target)
      values ('x', 'summer', 't', 'b', '{"type":"path","href":"/"}')`);
    check("улирал эхлэх өдөртэй хамт", /heroes_season_pair/.test(pair?.message ?? ""), pair?.message);
    const four = await errorOf(c, `update heroes set product_ids = array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()] where id = $1`, [ids.winter]);
    check("үнэртэн ихдээ 3", /heroes_product_count/.test(four?.message ?? ""), four?.message);

    await setFlag(c, "hero_admin", false);
    check("туг хаалттай → live_heroes хоосон", (await c.query("select * from live_heroes()")).rowCount === 0);
    const off = await errorOf(c, `update heroes set title = 'x' where id = $1`, [ids.winter]);
    check("туг хаалттай → бичилт FEATURE_DISABLED", /FEATURE_DISABLED/.test(off?.message ?? ""), off?.message);
  });

  await c.end();
  console.log(failed ? `\n✖ ${failed} шалгалт унасан.` : "\n✅ Бүх шалгалт амжилттай.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
