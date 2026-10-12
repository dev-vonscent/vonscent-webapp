-- Өртгийн мэдээллийг PostgREST-ээс хаана.
--
-- ## Асуудал
--
-- 1. `products.bottle_price` (эх савны худалдан авсан үнэ — тайлангийн өртөг,
--    0027) ба `reference_image_url` (AI-д өгсөн эх зураг, 0031a) нь anon key-ээр
--    `GET /rest/v1/products?select=name,bottle_price` гэж шууд уншигдана.
--    "products read" policy (0125) нь МӨР шүүдэг — баганыг биш. 0125-аас хойш
--    «Тун удахгүй» бараанд ч мөн нээлттэй.
-- 2. `restock_log` (худалдан авалтын `cost`) дээр RLS огт асаагаагүй — Supabase-
--    ийн анхдагч эрхээр anon/authenticated нь уншиж, БИЧИЖ, устгаж чадна.
-- 3. `_app_migrations` (scripts/migrate.ts) мөн RLS-гүй — anon мөр устгавал
--    дараагийн migrate хэрэгжсэн файлыг дахин ажиллуулна.
--
-- ## Шийдэл
--
-- 1. Хүснэгтийн SELECT-ийг авч, нийтийн багануудыг нэрээр нь буцааж өгнө.
--    Хүснэгтийн түвшний эрх байхад баганын `revoke` үйлчлэхгүй тул ингэхээс
--    өөр арга алга. ⚠ Цаашид `products`-д багана нэмбэл anon/authenticated-д
--    АВТОМАТААР ХАРАГДАХГҮЙ (permission denied) — нийтэд хэрэгтэй бол
--    `grant select (col) on products to anon, authenticated` нэм.
--    `authenticated`-аас ч авна: нэвтэрсэн ямар ч үйлчлүүлэгч уншиж чадах
--    байсан. Админ (staff cookie client) энэ хоёр баганыг
--    `admin_product_private()`-ээр уншина.
-- 2. `restock_log`: RLS асааж зөвхөн staff унших policy. Бичилт нь
--    `restock_inventory` / `mark_order_refunded` (зөвхөн service_role) ба
--    DEFINER trigger-ээр явдаг тул RLS-ийг тойрно.
-- 3. `_app_migrations`: policy-гүй RLS. migrate.ts нь хүснэгтийн эзэн
--    (postgres) тул нөлөөгүй.
--
-- INSERT/UPDATE/DELETE эрхэд хүрэхгүй — "products write" policy хэвээр.

-- ── 1. products: баганын түвшний SELECT ─────────────────────────────────
revoke select on products from anon, authenticated;
grant select (
  id, slug, name, brand, brand_id, description,
  notes_top, notes_heart, notes_base, notes_description, usage_description,
  gender, concentration, sillage, longevity, scent_families, seasons,
  origin_country, release_year, bottle_ml, rating_avg, rating_count,
  is_active, is_featured, search_text, status, launched_at, coming_soon_note,
  created_at, updated_at
) on products to anon, authenticated;

-- Админы засах хуудас ба жагсаалт (staff cookie client) эдгээрийг уншина.
-- Staff биш бол хоосон — алдаа шидэхгүй (дуудагч нь хоосныг өөрөө шийднэ).
create or replace function admin_product_private(p_ids uuid[])
returns table (id uuid, bottle_price int, reference_image_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.bottle_price, p.reference_image_url
  from products p
  where p.id = any(p_ids) and is_staff();
$$;

revoke all on function admin_product_private(uuid[]) from public, anon;
grant execute on function admin_product_private(uuid[]) to authenticated, service_role;

-- ── 2. restock_log ─────────────────────────────────────────────────────
alter table restock_log enable row level security;
drop policy if exists "restock_log staff read" on restock_log;
create policy "restock_log staff read" on restock_log for select
  using (is_staff());

-- ── 3. _app_migrations ─────────────────────────────────────────────────
alter table if exists _app_migrations enable row level security;
