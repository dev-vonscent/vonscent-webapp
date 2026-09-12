-- Сэтгэгдлийн нийтийн харагдац + `updated_at`.
--
-- 1. `updated_at` — сэтгэгдэл нь upsert-ээр засагддаг (нэг хэрэглэгч × нэг
--    бүтээгдэхүүн = нэг мөр) атлаа зөвхөн `created_at`-тай байв. Өнөөдөр
--    зассан сэтгэгдэл «3 сарын өмнө» гэж харагддаг байсныг засна.
--
-- 2. `public_reviews` — сэтгэгдэл бичигчийн нэр/зураг нь `profiles`-д байдаг
--    ба тэнд RLS нь эзэн/ажилтанд л уншуулдаг. Тиймээс сэтгэгдлийг унших код
--    нэрийг олохын тулд **service-role** client руу шилжиж, RLS-ийг бүхэлд нь
--    тойрч байв (features/reviews/api.ts). Нийтэд харагдах ёстой цөөн хэдэн
--    баганыг харагдацаар ил гаргаж, anon key-ээр уншдаг болгоё.
--
--    `security_invoker` ЗОРИУДААР тавиагүй (catalog_items-ээс ялгаатай):
--    харагдац эзэмшигчийн эрхээр ажиллах нь энд гол санаа — `profiles`-ийн
--    RLS-ийг зөвхөн ЭНЭ хоёр багана (`full_name`, `avatar_url`) дээр,
--    зөвхөн уншихаар нээж байна. Имэйл, утас, эрх, хаяг ил гарахгүй.
--    `user_id` нь `reviews`-ийн "review read using (true)" бодлогоор аль
--    хэдийн нийтэд нээлттэй.

alter table reviews add column if not exists updated_at timestamptz;
update reviews set updated_at = created_at where updated_at is null;
alter table reviews alter column updated_at set default now();
alter table reviews alter column updated_at set not null;

create or replace function reviews_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- Upsert нь `created_at`-ыг дамжуулдаггүй ч, дамжуулсан ч хуучин мөрийн
  -- бичигдсэн огноо хөдлөхгүй байх ёстой.
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists reviews_touch_updated_at on reviews;
create trigger reviews_touch_updated_at
  before update on reviews
  for each row execute function reviews_touch_updated_at();

create or replace view public_reviews as
  select
    r.id,
    r.product_id,
    r.user_id,
    r.rating,
    r.body,
    r.created_at,
    r.updated_at,
    -- Хоосон/зайтай нэрийг null болгоно; харагдах өгөгдмөл нэрийг UI шийднэ.
    nullif(btrim(pf.full_name), '') as author_name,
    pf.avatar_url as author_avatar,
    p.name as product_name,
    p.slug as product_slug,
    p.brand as product_brand,
    p.is_active as product_is_active,
    -- Эхний ХАРАГДАХ зураг (0049), catalog_items-тэй ижил дүрмээр.
    (select pi.url from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as product_image
  from reviews r
  join products p on p.id = r.product_id
  left join profiles pf on pf.id = r.user_id;

comment on view public_reviews is
  'Нийтэд харагдах сэтгэгдэл: бичигчийн нэр/зураг ба бүтээгдэхүүний товч '
  'мэдээлэл. Эзэмшигчийн эрхээр ажиллана (security_invoker БИШ) — ингэснээр '
  'profiles-ийн RLS-ийг тойрохгүйгээр зөвхөн энэ хоёр баганыг anon-д нээнэ. '
  'src/features/reviews/api.ts эндээс уншина.';

grant select on public_reviews to anon, authenticated;

-- Хуудаслалт нь (product_id, created_at desc, id desc)-ээр эрэмбэлдэг;
-- `reviews_product_idx` нь зөвхөн product_id-г барьдаг тул эрэмбийг дагасан
-- индекс нэмье.
create index if not exists reviews_product_created_idx
  on reviews (product_id, created_at desc, id desc);
