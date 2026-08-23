/**
 * Seed rich DEMO data on top of the base catalogue.
 *
 *   pnpm db:seed        # base products first (idempotent)
 *   pnpm db:seed:demo   # then this
 *
 * Creates auth users (roles), addresses, reviews, coupons, orders (some paid,
 * spread over time), blog posts, FAQs, hero banners, content settings and
 * newsletter subscribers. Safe to re-run (idempotent where practical).
 */
import { createClient } from "@supabase/supabase-js";
import { BLOG_POSTS } from "../src/features/blog/seed";
import { FAQ_SEED } from "../src/features/faq/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

async function getOrCreateUser(
  email: string,
  fullName: string,
  password = "vonscent123",
): Promise<string> {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (data?.user) return data.user.id;
  if (error && !/already.*registered|already.*exists/i.test(error.message)) {
    console.warn(`  user ${email}: ${error.message}`);
  }
  // Already exists — find it.
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users.find((u) => u.email === email);
  if (!found) throw new Error(`Could not create or find user ${email}`);
  return found.id;
}

const CUSTOMERS = [
  { email: "bat@example.com", name: "Батбаяр", phone: "99112233" },
  { email: "saruul@example.com", name: "Саруул", phone: "88445566" },
  { email: "temuujin@example.com", name: "Тэмүүжин", phone: "95778899" },
  { email: "nomin@example.com", name: "Номин", phone: "91234567" },
  { email: "enkhjin@example.com", name: "Энхжин", phone: "94561237" },
];

const REVIEW_BODIES = [
  "Маш сайхан үнэр, удаан тогтдог.",
  "Хүлээлтээс илүү таалагдсан. Дахин авна.",
  "Decant хэлбэр нь туршихад тун тохиромжтой.",
  "Үнэ цэнэдээ тохирсон, сав нь цэвэрхэн ирсэн.",
  "Өдөр тутамд хэрэглэхэд гоё.",
  "Найзууд маань үнэрийг минь байнга магтдаг болсон.",
  "",
];

const SEASON_BY_FAMILY: Record<string, string> = {
  fresh: "summer",
  citrus: "summer",
  floral: "spring",
  woody: "winter",
  oriental: "winter",
  spicy: "autumn",
};

async function main() {
  // ── 0. Tag products with a season for the seasonal filter ───────────────
  const { data: prodRows } = await sb
    .from("products")
    .select("id, slug, scent_family, product_variants ( id, ml, is_active )");
  const products = (prodRows ?? []) as {
    id: string;
    slug: string;
    scent_family: string | null;
    product_variants: { id: string; ml: number; is_active: boolean }[];
  }[];
  if (products.length === 0) {
    console.error("No products found — run `pnpm db:seed` first.");
    process.exit(1);
  }
  for (const p of products) {
    const season = SEASON_BY_FAMILY[p.scent_family ?? ""] ?? "all";
    await sb.from("products").update({ season }).eq("id", p.id);
  }
  console.log(`✓ Tagged ${products.length} products with seasons`);

  // ── 1. Staff + customer auth users ──────────────────────────────────────
  const adminId = await getOrCreateUser("admin@vonscent.mn", "Админ");
  const opId = await getOrCreateUser("operator@vonscent.mn", "Оператор");
  const courierId = await getOrCreateUser("courier@vonscent.mn", "Хүргэгч");
  await sb
    .from("profiles")
    .update({ role: "super_admin", phone: "80000000" })
    .eq("id", adminId);
  await sb
    .from("profiles")
    .update({ role: "operator", phone: "80000001" })
    .eq("id", opId);
  await sb
    .from("profiles")
    .update({ role: "courier", phone: "80000002" })
    .eq("id", courierId);

  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const id = await getOrCreateUser(c.email, c.name);
    await sb
      .from("profiles")
      .update({
        full_name: c.name,
        phone: c.phone,
        loyalty_points: Math.floor(Math.random() * 300),
      })
      .eq("id", id);
    customerIds.push(id);
  }
  console.log(
    `✓ Users: 1 admin, 1 operator, 1 courier, ${customerIds.length} customers`,
  );
  console.log("  (login: admin@vonscent.mn / vonscent123)");

  // ── 2. Addresses ────────────────────────────────────────────────────────
  const DISTRICTS = [
    "Сүхбаатар",
    "Баянзүрх",
    "Хан-Уул",
    "Чингэлтэй",
    "Сонгино хайрхан",
  ];
  for (let i = 0; i < customerIds.length; i++) {
    const uid = customerIds[i];
    const { count } = await sb
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((count ?? 0) > 0) continue;
    await sb.from("addresses").insert({
      user_id: uid,
      label: "Гэр",
      recipient: CUSTOMERS[i].name,
      phone: CUSTOMERS[i].phone,
      city: "Улаанбаатар",
      district: rand(DISTRICTS),
      detail: `${1 + i} хороо, ${10 + i}-р байр, ${i + 1}0 тоот`,
      is_default: true,
    });
  }
  console.log("✓ Addresses");

  // ── 3. Reviews ──────────────────────────────────────────────────────────
  for (const p of products) {
    const n = 3 + Math.floor(Math.random() * 3);
    const reviewers = [...customerIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, n);
    for (const uid of reviewers) {
      await sb.from("reviews").upsert(
        {
          product_id: p.id,
          user_id: uid,
          rating: 3 + Math.floor(Math.random() * 3),
          body: rand(REVIEW_BODIES),
        },
        { onConflict: "product_id,user_id" },
      );
    }
    await sb.rpc("recompute_rating", { p_product: p.id });
  }
  console.log("✓ Reviews + ratings recomputed");

  // ── 4. Coupons ──────────────────────────────────────────────────────────
  const coupons: Array<{
    code: string;
    type: string;
    value: number;
    min_subtotal: number;
    max_uses: number | null;
    ends_at: string;
    is_active: boolean;
  }> = [
    {
      code: "WELCOME10",
      type: "percent",
      value: 10,
      min_subtotal: 0,
      max_uses: null,
      ends_at: daysAgo(-60),
      is_active: true,
    },
    {
      code: "SALE5000",
      type: "fixed",
      value: 5000,
      min_subtotal: 50000,
      max_uses: 100,
      ends_at: daysAgo(-30),
      is_active: true,
    },
    {
      code: "SUMMER20",
      type: "percent",
      value: 20,
      min_subtotal: 100000,
      max_uses: 50,
      ends_at: daysAgo(10),
      is_active: false,
    },
  ];
  for (const c of coupons) {
    await sb.from("coupons").upsert(c, { onConflict: "code" });
  }
  console.log("✓ Coupons");

  // ── 5. Orders (idempotent: skip if demo orders already exist) ───────────
  const { count: orderCount } = await sb
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("note", "%[demo]%");
  if ((orderCount ?? 0) === 0) {
    const STATUSES = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ] as const;
    const variants = products.flatMap((p) =>
      p.product_variants
        .filter((v) => v.is_active)
        .map((v) => ({ productId: p.id, variantId: v.id, ml: v.ml })),
    );

    for (let i = 0; i < 16; i++) {
      const withUser = i % 2 === 0;
      const uid = withUser ? rand(customerIds) : null;
      const lineCount = 1 + Math.floor(Math.random() * 3);
      const items = Array.from({ length: lineCount }).map(() => {
        const v = rand(variants);
        return {
          product_id: v.productId,
          variant_id: v.variantId,
          ml: v.ml,
          qty: 1 + Math.floor(Math.random() * 2),
          is_sample: false,
        };
      });
      const cust = withUser
        ? CUSTOMERS[customerIds.indexOf(uid as string)]
        : rand(CUSTOMERS);

      const { data: placed, error } = await sb.rpc("place_order", {
        p_order: {
          user_id: uid,
          payment_method: rand(["qpay", "bank_transfer"]),
          contact_name: cust.name,
          contact_phone: cust.phone,
          contact_email: null,
          ship_city: "Улаанбаатар",
          ship_district: rand(DISTRICTS),
          ship_detail: `${i + 1}-р байр, ${i + 1}0 тоот`,
          ship_zone: "Улаанбаатар дотор",
          note: "[demo] жишээ захиалга",
          shipping_fee: 5000,
          coupon_code: i % 5 === 0 ? "WELCOME10" : null,
          reserve_minutes: 30,
        },
        p_items: items,
      });
      if (error) {
        console.warn(`  order ${i}: ${error.message}`);
        continue;
      }
      const orderId = (placed as { order_id: string }).order_id;
      const status = STATUSES[i % STATUSES.length];

      // Mark most non-cancelled orders paid (also earns loyalty).
      if (status !== "pending" && status !== "cancelled") {
        await sb.rpc("mark_order_paid", { p_order: orderId });
      }
      if (
        status === "shipping" ||
        status === "delivered" ||
        status === "cancelled"
      ) {
        await sb.rpc("update_order_status", {
          p_order: orderId,
          p_status: status,
          p_note: "Demo төлөв",
          p_by: opId,
        });
      }
      // Spread the order date into the past.
      await sb
        .from("orders")
        .update({ created_at: daysAgo(i * 2) })
        .eq("id", orderId);
    }
    console.log("✓ Orders (16, mixed status/payment, dated)");
  } else {
    console.log("• Orders (demo orders already present — skipped)");
  }

  // ── 6. Blog posts ───────────────────────────────────────────────────────
  for (const post of BLOG_POSTS) {
    await sb.from("blog_posts").upsert(
      {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        cover_url: post.cover,
        category: post.category,
        is_published: true,
        published_at: new Date(post.date).toISOString(),
      },
      { onConflict: "slug" },
    );
  }
  console.log("✓ Blog posts");

  // ── 7. FAQs (only if empty) ─────────────────────────────────────────────
  const { count: faqCount } = await sb
    .from("faqs")
    .select("id", { count: "exact", head: true });
  if ((faqCount ?? 0) === 0) {
    await sb.from("faqs").insert(
      FAQ_SEED.map((f, i) => ({
        category: f.category,
        question: f.question,
        answer: f.answer,
        sort_order: i,
      })),
    );
  }
  console.log("✓ FAQs");

  // ── 8. Hero banners (only if empty) ─────────────────────────────────────
  const { count: bannerCount } = await sb
    .from("hero_banners")
    .select("id", { count: "exact", head: true });
  if ((bannerCount ?? 0) === 0) {
    await sb.from("hero_banners").insert([
      {
        title: "Үнэрээ ол",
        subtitle: "5/10/20мл багцаар туршиж сонгоорой",
        cta_label: "Бараа үзэх",
        cta_href: "/catalog",
        sort_order: 0,
      },
      {
        title: "Шинэ ирэлт",
        subtitle: "Хамгийн сүүлийн үнэртнүүд",
        cta_label: "Үзэх",
        cta_href: "/catalog?tags=new",
        sort_order: 1,
      },
    ]);
  }
  console.log("✓ Hero banners");

  // ── 9. Content settings: popup (multi-slide), social, about ─────────────
  await sb.from("settings").upsert({
    key: "popup",
    value: {
      enabled: true,
      frequencyHours: 24,
      slides: [
        {
          title: "Шинэ хэрэглэгчдэд 10%",
          body: "WELCOME10 кодоор эхний захиалгадаа хямдрал аваарай.",
          ctaLabel: "Дэлгүүр",
          ctaHref: "/catalog",
          imageUrl: null,
          startsAt: null,
          endsAt: null,
        },
        {
          title: "Зуны шинэ цуглуулга",
          body: "Сэрэг, цитрус үнэртнүүд ирлээ.",
          ctaLabel: "Үзэх",
          ctaHref: "/catalog?season=summer",
          imageUrl: null,
          startsAt: null,
          endsAt: null,
        },
      ],
    },
  });
  await sb.from("settings").upsert({
    key: "social",
    value: {
      instagram: "https://instagram.com/vonscent.mn",
      facebook: "https://facebook.com/vonscent.mn",
      phone: "+976 8000 0000",
      email: "hello@vonscent.mn",
    },
  });
  await sb.from("settings").upsert({
    key: "about",
    value: {
      story:
        "vonscent нь дэлхийн шилдэг үнэртнүүдийг жижиг (decant) багцаар санал болгодог. Бид итгэдэг — үнэр бол хувь хүний илэрхийлэл.",
      values: [],
      team: [
        { name: "Б. Тэнгис", role: "Үүсгэн байгуулагч", image: "" },
        { name: "С. Саруул", role: "Үйлчилгээний менежер", image: "" },
      ],
    },
  });
  console.log("✓ Content settings (popup/social/about)");

  // ── 10. Newsletter subscribers ──────────────────────────────────────────
  const emails = [
    "fan1@example.com",
    "fan2@example.com",
    "fan3@example.com",
    "fan4@example.com",
    "fan5@example.com",
  ];
  for (const email of emails) {
    await sb
      .from("newsletter_subscribers")
      .upsert({ email }, { onConflict: "email" });
  }
  console.log("✓ Newsletter subscribers");

  console.log("\n✅ Demo seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
