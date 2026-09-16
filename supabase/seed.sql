-- ============================================================================
-- vonscent — туршилтын seed дата (preview / local ЗӨВХӨН)
-- ============================================================================
--
-- Хэрэглэх нь:
--   psql "$DATABASE_URL" -f supabase/seed.sql      # preview / local
--   supabase db reset                              # local (автоматаар уншина)
--
-- ⚠️  PRODUCTION ДЭЭР ХЭЗЭЭ Ч БИТГИЙ АЖИЛЛУУЛ. Доор хамгаалалт бий: энэ
--     файлын үүсгээгүй захиалга санд байвал script шууд зогсоно (жинхэнэ
--     борлуулалт бүхий сан гэж үзнэ). Гэхдээ энэ нь техникийн хамгаалалт л —
--     зөв сан руу заасан эсэхээ өөрөө нэг дахин шалга.
--
-- Идемпотент: slug/key-ээр `on conflict do nothing`. Дахин ажиллуулахад
-- давхардсан мөр үүсэхгүй, байгаа мөрийг дарж бичихгүй.
--
-- ХИЙМЭЛ ДАТА. Бодит хүний нэр, и-мэйл, утасны дугаар ОРООГҮЙ:
--   • Утас — 9900000X (туршилтад зориулсан дугаарууд)
--   • И-мэйл — `<утас>@phone.vonscent.mn` (phone auth-ийн синтетик домэйн,
--     src/lib/auth/phone-email.ts; гаднаас хүрэх боломжгүй хаяг)
--   • Брэнд/бараа — БҮГД ХИЙМЭЛ нэр. Бодит үнэртний брэнд зориуд аваагүй:
--     preview дээрх дата хаа нэгтээ гарвал жинхэнэ каталогтой андуурагдахгүй.
--
-- Migration-ууд аль хэдийн seed хийдэг зүйлсийг энд ДАХИН оруулаагүй:
--   tags (0003) · scent_families (0018) · custom_tags (0044) ·
--   settings (0002, 0021, 0038, 0039, 0051, 0053b) · spin_wheel_prizes (0053b) ·
--   zone_areas (0043)
-- ============================================================================

-- ── 0. Хамгаалалт ───────────────────────────────────────────────────────────
-- Энэ seed өөрөө хоёр захиалга үүсгэдэг тул «захиалга байвал зогс» гэвэл
-- дахин ажиллуулах боломжгүй болно. Тиймээс ЗӨВХӨН энэ файлын үүсгээгүй
-- захиалга байгаа эсэхийг шалгана: seed-ийн id-ууд нь тогтмол,
-- `00000000-0000-4000-9000-…` угтвартай.
do $$
begin
  if exists (
    select 1 from orders
     where id::text not like '00000000-0000-4000-9000-%'
     limit 1
  ) then
    raise exception
      'ЗОГСЛОО: seed-ийн бус захиалга олдлоо — энэ нь production байж магадгүй. '
      'seed.sql нь зөвхөн preview/local-д зориулагдсан.';
  end if;
end $$;

begin;

-- ── 1. Брэнд ────────────────────────────────────────────────────────────────
insert into brands (slug, name, sort_order) values
  ('aurelia-atelier', 'Aurelia Atelier', 1),
  ('noctis-parfums',  'Noctis Parfums',  2),
  ('verdant-house',   'Verdant House',   3),
  ('lumen-studio',    'Lumen Studio',    4)
on conflict (slug) do nothing;

-- ── 2. Бараа ────────────────────────────────────────────────────────────────
-- Үнэ бүгд integer ₮ (float хэрэглэхгүй — CLAUDE.md). `bottle_price` нь эх
-- савны үнэ: үлдэгдэл/ашгийн тайланд л ашиглагдана, ml үнэд НӨЛӨӨЛӨХГҮЙ.
insert into products (
  slug, name, brand, brand_id, description,
  notes_top, notes_heart, notes_base,
  gender, concentration, origin_country, release_year,
  bottle_price, bottle_ml, scent_families, seasons,
  sillage, longevity, notes_description, usage_description,
  is_active, is_featured
)
select
  v.slug, v.name, v.brand, b.id, v.description,
  v.notes_top, v.notes_heart, v.notes_base,
  v.gender::gender_t, v.concentration::concentration_t, v.origin_country, v.release_year,
  v.bottle_price, v.bottle_ml, v.scent_families, v.seasons::season_t[],
  v.sillage::sillage_t, v.longevity, v.notes_description, v.usage_description,
  true, v.is_featured
from (values
  ('aurelia-golden-hour', 'Golden Hour', 'Aurelia Atelier', 'aurelia-atelier',
   'Наранд дулаацсан амбер, ваниль. Оройн цагт хамгийн сайн нээгддэг дулаан үнэр.',
   array['бергамот','лийр'], array['сарнай','ирис'], array['амбер','ваниль','мускус'],
   'unisex', 'EDP', 'Франц', 2023, 890000, 100,
   array['oriental','floral'], array['autumn','winter'],
   'strong', '8-10 цаг',
   'Дээд нот нь цитрус боловч хэдхэн минутын дараа амбер рүү бүрэн шилждэг.',
   'Оройн үйл явдал, хүйтэн сард. Хүзүүний хажуугаар 2 удаа хүрэлцэнэ.',
   true),

  ('aurelia-white-linen', 'White Linen', 'Aurelia Atelier', 'aurelia-atelier',
   'Цэвэрхэн саван, хөвөн даавууны сэнгэнэ. Оффист тохиромжтой дөлгөөн үнэр.',
   array['лимон','нэрс'], array['хөвөн цэцэг','цагаан цай'], array['мускус','кедр'],
   'unisex', 'EDT', 'Итали', 2022, 640000, 100,
   array['fresh','citrus'], array['spring','summer'],
   'light', '4-5 цаг',
   'Саван шинж нь эхнээсээ илэрч, өдрийн турш нам гүм тогтдог.',
   'Ажлын өдөр, халуун сард. Хувцасны зах руу биш, гарын судсанд.',
   false),

  ('noctis-midnight-oud', 'Midnight Oud', 'Noctis Parfums', 'noctis-parfums',
   'Уд мод, тамхины навч, арьс шир. Хүчтэй, өвлийн оройн үнэр.',
   array['гүргэм','чинжүү'], array['сарнай','тамхи'], array['уд','арьс','сандал'],
   'male', 'Extrait', 'ОАЭ', 2021, 1450000, 50,
   array['woody','spicy','oriental'], array['winter'],
   'strong', '12 цаг ба түүнээс дээш',
   'Уд нь эхнээсээ тод; цаг хугацаа өнгөрөх тусам тамхи, арьс нь илэрнэ.',
   'Хүйтэн орой, онцгой үйл явдал. Нэг хүрэлт хангалттай — хэтрүүлбэл хүнд.',
   true),

  ('noctis-velvet-rose', 'Velvet Rose', 'Noctis Parfums', 'noctis-parfums',
   'Хилэн шиг зузаан сарнай, амбер дээр. Романтик, эмэгтэйлэг.',
   array['бөөрөлзгөнө','личи'], array['сарнай','пион'], array['амбер','пачули'],
   'female', 'EDP', 'Франц', 2024, 980000, 75,
   array['floral','oriental'], array['autumn','spring'],
   'medium', '7-8 цаг',
   'Сарнай нь чихэрлэг биш, харин зузаан, тослог шинжтэй.',
   'Болзоо, оройн цуглаан. Үс, хүзүүнд.',
   true),

  ('verdant-fig-garden', 'Fig Garden', 'Verdant House', 'verdant-house',
   'Инжрийн навч, ногоон хушга. Зуны цэцэрлэгийн сэрүүн үнэр.',
   array['инжир','ногоон навч'], array['хушга','кокос'], array['кедр','мускус'],
   'unisex', 'EDT', 'Испани', 2023, 720000, 100,
   array['fresh','woody'], array['spring','summer'],
   'medium', '5-6 цаг',
   'Инжрийн навчны гашуун-ногоон шинж нь бүх хугацаанд гол үүрэг гүйцэтгэнэ.',
   'Өдөр тутам, дулаан сард. Хувцас, арьсанд адилхан сайн.',
   false),

  ('verdant-cedar-smoke', 'Cedar Smoke', 'Verdant House', 'verdant-house',
   'Утаат кедр, хуурай ургамал. Тайван, эрчүүдэд илүү тохиромжтой.',
   array['элеми','кардамон'], array['кедр','ветивер'], array['утаа','хус'],
   'male', 'EDP', 'Швед', 2022, 810000, 100,
   array['woody'], array['autumn','winter'],
   'medium', '6-8 цаг',
   'Утаа нь хиймэл биш, хуурай модны шинжтэй.',
   'Өдөр тутам, хүйтэн сард. Оффист ч болно.',
   false),

  ('lumen-citrus-salt', 'Citrus Salt', 'Lumen Studio', 'lumen-studio',
   'Далайн сэнгэнэ, цитрусын хальс. Хамгийн сэрүүн сонголт.',
   array['грейпфрут','бергамот'], array['далайн ус','розмарин'], array['мускус','амброксан'],
   'unisex', 'EDC', 'Португал', 2024, 540000, 100,
   array['citrus','fresh'], array['summer'],
   'light', '3-4 цаг',
   'Маш хурдан нээгддэг, харин удаан тогтдоггүй — зунд зориулсан.',
   'Халуун өдөр, спортын дараа. Дахин хүрэлцэхэд бэлэн бай.',
   false),

  ('lumen-vanilla-dust', 'Vanilla Dust', 'Lumen Studio', 'lumen-studio',
   'Нунтаг ваниль, ирис. Зөөлөн, ойр зайд мэдрэгддэг.',
   array['ирис','нэрс'], array['ваниль','тонка'], array['мускус','сандал'],
   'female', 'EDP', 'Франц', 2023, 760000, 50,
   array['oriental','floral'], array['autumn','winter'],
   'light', '6-7 цаг',
   'Чихэрлэг биш ваниль — нунтаг, ирис нь түүнийг хатууруулж байдаг.',
   'Өдөр тутам, ажлын орой. Ойр зайд л мэдрэгдэнэ.',
   true)
) as v(slug, name, brand, brand_slug, description,
       notes_top, notes_heart, notes_base,
       gender, concentration, origin_country, release_year,
       bottle_price, bottle_ml, scent_families, seasons,
       sillage, longevity, notes_description, usage_description,
       is_featured)
join brands b on b.slug = v.brand_slug
on conflict (slug) do nothing;

-- ── 3. Хэмжээний хувилбар + үнэ ────────────────────────────────────────────
-- Хэмжээ бүрийн үнэ ГАРААР (0027_manual_pricing) — коэффициент байхгүй.
-- 2ml нь sample БИШ, 5/10/20-той адил энгийн сонголт (CLAUDE.md).
insert into product_variants (product_id, ml, price, sale_price)
select p.id, v.ml, v.price, v.sale_price
from products p
join (values
  ('aurelia-golden-hour',  2,  16000, null),
  ('aurelia-golden-hour',  5,  36000, null),
  ('aurelia-golden-hour', 10,  68000, 58000),
  ('aurelia-golden-hour', 20, 128000, null),

  ('aurelia-white-linen',  2,  11000, null),
  ('aurelia-white-linen',  5,  25000, null),
  ('aurelia-white-linen', 10,  46000, null),
  ('aurelia-white-linen', 20,  86000, null),

  ('noctis-midnight-oud',  2,  28000, null),
  ('noctis-midnight-oud',  5,  64000, null),
  ('noctis-midnight-oud', 10, 120000, null),
  ('noctis-midnight-oud', 20, 225000, null),

  ('noctis-velvet-rose',   2,  18000, null),
  ('noctis-velvet-rose',   5,  41000, 36000),
  ('noctis-velvet-rose',  10,  76000, null),
  ('noctis-velvet-rose',  20, 142000, null),

  ('verdant-fig-garden',   2,  13000, null),
  ('verdant-fig-garden',   5,  29000, null),
  ('verdant-fig-garden',  10,  54000, null),
  ('verdant-fig-garden',  20, 100000, null),

  ('verdant-cedar-smoke',  2,  14000, null),
  ('verdant-cedar-smoke',  5,  32000, null),
  ('verdant-cedar-smoke', 10,  60000, null),
  ('verdant-cedar-smoke', 20, 112000, null),

  ('lumen-citrus-salt',    2,   9000, null),
  ('lumen-citrus-salt',    5,  21000, null),
  ('lumen-citrus-salt',   10,  39000, null),
  ('lumen-citrus-salt',   20,  72000, null),

  ('lumen-vanilla-dust',   2,  13000, null),
  ('lumen-vanilla-dust',   5,  30000, null),
  ('lumen-vanilla-dust',  10,  56000, null),
  ('lumen-vanilla-dust',  20, 104000, null)
) as v(slug, ml, price, sale_price) on v.slug = p.slug
on conflict (product_id, ml) do nothing;

-- ── 4. Үлдэгдэл ─────────────────────────────────────────────────────────────
-- Төрөл бүрийн төлөв: хэвийн, бага үлдэгдэл, бүрэн дууссан, reserve-тэй.
-- `available_ml` нь generated багана — гараар бичихгүй.
insert into inventory (product_id, on_hand_ml, reserved_ml, low_stock_ml, is_sold_out)
select p.id, v.on_hand, v.reserved, v.low_stock, v.sold_out
from products p
join (values
  ('aurelia-golden-hour',  400,  30, 50, false),  -- хэвийн, reserve-тэй
  ('aurelia-white-linen',  180,   0, 50, false),  -- хэвийн
  ('noctis-midnight-oud',   35,   5, 50, false),  -- бага үлдэгдэл (low_stock-оос доош)
  ('noctis-velvet-rose',   260,  15, 50, false),
  ('verdant-fig-garden',     0,   0, 50, true),   -- бүрэн дууссан
  ('verdant-cedar-smoke',  320,   0, 50, false),
  ('lumen-citrus-salt',    500,  80, 60, false),  -- их reserve
  ('lumen-vanilla-dust',    48,   8, 50, false)   -- бага үлдэгдэл
) as v(slug, on_hand, reserved, low_stock, sold_out) on v.slug = p.slug
on conflict (product_id) do nothing;

-- ── 5. Барааны зураг ───────────────────────────────────────────────────────
-- `images.unsplash.com` нь next.config.ts-ийн remotePatterns-д зөвшөөрөгдсөн.
-- Preview-ийн Supabase Storage хоосон тул гадны зураг ашиглав.
insert into product_images (product_id, url, alt, sort_order, is_visible)
select p.id, v.url, v.alt, v.sort_order, true
from products p
join (values
  ('aurelia-golden-hour', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&q=80', 'Golden Hour сав', 0),
  ('aurelia-golden-hour', 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1200&q=80', 'Golden Hour хайрцаг', 1),
  ('aurelia-white-linen', 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=1200&q=80', 'White Linen сав', 0),
  ('noctis-midnight-oud', 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=1200&q=80', 'Midnight Oud сав', 0),
  ('noctis-velvet-rose',  'https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=1200&q=80', 'Velvet Rose сав', 0),
  ('verdant-fig-garden',  'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=1200&q=80', 'Fig Garden сав', 0),
  ('verdant-cedar-smoke', 'https://images.unsplash.com/photo-1610461888750-10bfc601b874?w=1200&q=80', 'Cedar Smoke сав', 0),
  ('lumen-citrus-salt',   'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=1200&q=80', 'Citrus Salt сав', 0),
  ('lumen-vanilla-dust',  'https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=1200&q=80', 'Vanilla Dust сав', 0)
) as v(slug, url, alt, sort_order) on v.slug = p.slug
where not exists (
  select 1 from product_images pi where pi.product_id = p.id and pi.url = v.url
);

-- ── 6. Таг холболт ─────────────────────────────────────────────────────────
-- `tags` (new/hot/sale) нь 0003-д, `custom_tags` нь 0044-д seed хийгдсэн.
insert into product_tags (product_id, tag_id)
select p.id, t.id
from products p
join (values
  ('aurelia-golden-hour', 'hot'),
  ('aurelia-golden-hour', 'sale'),
  ('noctis-velvet-rose',  'new'),
  ('noctis-velvet-rose',  'sale'),
  ('lumen-citrus-salt',   'new'),
  ('noctis-midnight-oud', 'hot')
) as v(slug, tag_slug) on v.slug = p.slug
join tags t on t.slug = v.tag_slug
on conflict (product_id, tag_id) do nothing;

insert into product_custom_tags (product_id, tag_id)
select p.id, ct.id
from products p
join (values
  ('aurelia-golden-hour', 'date'),
  ('aurelia-golden-hour', 'amber'),
  ('aurelia-golden-hour', 'long-lasting'),
  ('aurelia-white-linen', 'office'),
  ('aurelia-white-linen', 'clean'),
  ('aurelia-white-linen', 'daily'),
  ('noctis-midnight-oud', 'oud'),
  ('noctis-midnight-oud', 'special'),
  ('noctis-midnight-oud', 'niche'),
  ('noctis-velvet-rose',  'rose'),
  ('noctis-velvet-rose',  'date'),
  ('verdant-fig-garden',  'daily'),
  ('verdant-fig-garden',  'youthful'),
  ('verdant-cedar-smoke', 'smoky'),
  ('verdant-cedar-smoke', 'mature'),
  ('lumen-citrus-salt',   'sport'),
  ('lumen-citrus-salt',   'marine'),
  ('lumen-vanilla-dust',  'vanilla'),
  ('lumen-vanilla-dust',  'powdery')
) as v(slug, tag_slug) on v.slug = p.slug
join custom_tags ct on ct.slug = v.tag_slug
on conflict (product_id, tag_id) do nothing;

-- ── 7. Багц (collection) ───────────────────────────────────────────────────
insert into collections (slug, type, name, gender, description, discount_pct, is_active, is_featured) values
  ('oroin-tuguldur', 'base', 'Оройн бүрэн багц', 'unisex',
   'Оройн үйл явдалд зориулсан дөрвөн үнэрийн танилцах багц.', 10, true, true),
  ('ajliin-odor',    'base', 'Ажлын өдрийн багц', 'unisex',
   'Оффист хэт хүчтэй биш, өдөржин тогтох гурван сонголт.', 8, true, false),
  ('zuny-serguuleg', 'base', 'Зуны сэрүүлэг', 'unisex',
   'Халуун сард зориулсан сэрүүн, хөнгөн багц.', 5, true, false)
on conflict (slug) do nothing;

insert into collection_items (collection_id, product_id, sort_order)
select c.id, p.id, v.sort_order
from (values
  ('oroin-tuguldur', 'aurelia-golden-hour', 0),
  ('oroin-tuguldur', 'noctis-midnight-oud', 1),
  ('oroin-tuguldur', 'noctis-velvet-rose',  2),
  ('oroin-tuguldur', 'lumen-vanilla-dust',  3),
  ('ajliin-odor',    'aurelia-white-linen', 0),
  ('ajliin-odor',    'verdant-cedar-smoke', 1),
  ('ajliin-odor',    'lumen-vanilla-dust',  2),
  ('zuny-serguuleg', 'lumen-citrus-salt',   0),
  ('zuny-serguuleg', 'verdant-fig-garden',  1),
  ('zuny-serguuleg', 'aurelia-white-linen', 2)
) as v(coll_slug, prod_slug, sort_order)
join collections c on c.slug = v.coll_slug
join products p on p.slug = v.prod_slug
on conflict (collection_id, product_id) do nothing;

-- Багц дотор ml тус бүрийн хямдрал/үнэ (0051).
insert into collection_ml_discounts (collection_id, ml, discount_pct, price)
select c.id, v.ml, v.discount_pct, v.price
from (values
  ('oroin-tuguldur',  2, 12.00, null),
  ('oroin-tuguldur',  5, 15.00, null),
  ('oroin-tuguldur', 10, null,  240000),
  ('ajliin-odor',     5, 10.00, null),
  ('ajliin-odor',    10, 12.00, null)
) as v(coll_slug, ml, discount_pct, price)
join collections c on c.slug = v.coll_slug
on conflict (collection_id, ml) do nothing;

-- ── 8. Купон ────────────────────────────────────────────────────────────────
insert into coupons (code, type, value, min_subtotal, max_uses, max_uses_per_user, max_discount, starts_at, ends_at, is_active, source) values
  ('TEST10',    'percent', 10, 50000,  100, 1, 30000, now() - interval '1 day', now() + interval '90 days', true,  'manual'),
  ('TEST5000',  'fixed',   5000, 30000, 50, 2, null,  now() - interval '1 day', now() + interval '90 days', true,  'manual'),
  ('TESTBIG',   'percent', 25, 200000,  10, 1, 80000, now() - interval '1 day', now() + interval '30 days', true,  'manual'),
  ('TESTEXPIRED','percent',15, 0,       10, 1, null,  now() - interval '60 days', now() - interval '30 days', true, 'manual'),
  ('TESTOFF',   'fixed',   3000, 0,     10, 1, null,  now() - interval '1 day', now() + interval '30 days', false, 'manual')
on conflict (code) do nothing;

-- ── 9. FAQ ──────────────────────────────────────────────────────────────────
-- `faqs` нь зөвхөн uuid PK-тай (unique асуулт байхгүй) тул `on conflict` нь
-- давхардлаас ХАМГААЛАХГҮЙ — асуултаар нь шалгаж оруулна.
insert into faqs (category, question, answer, sort_order)
select v.category, v.question, v.answer, v.sort_order
from (values
  ('Бүтээгдэхүүн', 'Decant гэж юу вэ?',
   'Бүтэн савнаас жижиг саванд хэмжиж салгасан жинхэнэ үнэртэн. Хуулбар биш — эх савныхаа яг тэр шингэн.', 1),
  ('Бүтээгдэхүүн', '2ml хэр хугацаанд хүрэлцэх вэ?',
   'Өдөрт 2 удаа хүрэлцвэл 8-10 өдөр. Танилцахад тохиромжтой хэмжээ.', 2),
  ('Хүргэлт', 'Хүргэлт хэр хугацаанд ирэх вэ?',
   'Улаанбаатар хотод 1-2 хоног. Орон нутагт унаанаас хамаарч 3-7 хоног.', 3),
  ('Хүргэлт', 'Хүргэлтийн төлбөр хэд вэ?',
   'Дүн 100,000₮-өөс дээш бол үнэгүй. Түүнээс доош бол бүсээс хамаарна.', 4),
  ('Төлбөр', 'Ямар төлбөрийн хэрэгсэл ашиглах боломжтой вэ?',
   'QPay-ээр бүх банкны апп, эсвэл банкны шилжүүлэг.', 5),
  ('Захиалга', 'Захиалгаа цуцлаж болох уу?',
   'Хүргэлтэд гараагүй бол өөрийн хуудаснаас цуцална. Төлбөр 3-5 хоногт буцна.', 6)
) as v(category, question, answer, sort_order)
where not exists (select 1 from faqs f where f.question = v.question);

-- ── 10. Блог ────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, body, category, tags, is_published, published_at) values
  ('decant-gej-yu-be', 'Decant гэж юу вэ, яагаад хэрэгтэй вэ?',
   'Бүтэн сав худалдаж авахаасаа өмнө үнэрийг өөр дээрээ туршиж үзэх хамгийн хямд арга.',
   '<p>Үнэртэн дэлгүүрт таалагдсан үнэр арьсан дээр тэс өөрөөр гарах нь элбэг. Decant нь бүтэн савны үнийг төлөхөөс өмнө үнэрийг өдөр тутмын хэрэглээндээ турших боломж юм.</p><p>2ml нь ойролцоогоор 8-10 өдрийн хэрэглээ — үнэр тогтох эсэх, өөрт зохих эсэхийг мэдэхэд хангалттай.</p>',
   'Гарын авлага', array['decant','эхлэн суралцагч'], true, now() - interval '20 days'),
  ('unerin-tostor', 'Үнэрийн дүр төрөл: цэцэгт, модлог, сэргэг',
   'Үнэрийн үндсэн гэр бүлүүдийг мэдэх нь сонголтоо хумихад хамгийн хурдан арга.',
   '<p>Цэцэгт нь сарнай, ирис, пион зэрэг; модлог нь кедр, сандал, ветивер; сэргэг нь цитрус, далайн нот.</p><p>Өөрт таалагддаг гэр бүлээ мэдвэл шинэ үнэр сонгоход буруудах нь эрс багасна.</p>',
   'Гарын авлага', array['үнэрийн гэр бүл'], true, now() - interval '12 days'),
  ('unert-hadgalah', 'Үнэртнээ хэрхэн зөв хадгалах вэ?',
   'Гэрэл, халуун, чийг гурав нь үнэртний гол дайсан.',
   '<p>Цонхны тавцан, угаалгын өрөө хоёр нь хамгийн тохиромжгүй газар. Хүйтэн, харанхуй шүүгээнд, эх хайрцагтайгаа хадгалах нь хамгийн зөв.</p>',
   'Хадгалалт', array['хадгалалт','зөвлөгөө'], true, now() - interval '5 days'),
  ('ovlin-unert', 'Өвлийн үнэр сонгох нь',
   'Хүйтэнд үнэр илүү нягт, хүчтэй байх шаардлагатай.',
   '<p>Хүйтэн агаарт молекулууд хөдлөх нь багасдаг тул хөнгөн цитрус бараг мэдрэгдэхгүй. Амбер, уд, ваниль зэрэг нягт нот өвөлд илүү тохирно.</p>',
   'Гарын авлага', array['өвөл','сезон'], false, now()),
  ('sillage-longevity', 'Sillage ба тогтоц хоёрын ялгаа',
   'Хоёр өөр зүйл — нэг нь хэр тархахыг, нөгөө нь хэр удахыг хэлнэ.',
   '<p>Sillage нь үнэр хэр зайд мэдрэгдэхийг, тогтоц (longevity) нь хэр цаг арьсан дээр үлдэхийг хэлнэ. Хүчтэй sillage-тай атлаа хурдан арилдаг үнэр ч бий.</p>',
   'Гарын авлага', array['sillage','тогтоц'], true, now() - interval '2 days')
on conflict (slug) do nothing;

-- ── 11. Нүүр хуудасны хэсгүүд ──────────────────────────────────────────────
-- `home_sections` мөн зөвхөн uuid PK-тай — гарчгаар нь шалгана.
insert into home_sections (title, subtitle, href, kind, tag, max_items, sort_order, is_active)
select v.title, v.subtitle, v.href, v.kind, v.tag::tag_kind_t, v.max_items, v.sort_order, true
from (values
  ('Шинээр нэмэгдсэн', 'Хамгийн сүүлд ирсэн үнэрүүд', '/products?tag=new',  'tag',      'new',  8, 1),
  ('Эрэлттэй',         'Хамгийн их худалдаалагдсан',   '/products?tag=hot',  'tag',      'hot',  8, 2),
  ('Онцлох',           'Бид сонгож байна',             '/products',          'featured', null,   8, 3),
  ('Хямдралтай',       'Одоо хямдарсан',               '/products?tag=sale', 'tag',      'sale', 8, 4)
) as v(title, subtitle, href, kind, tag, max_items, sort_order)
where not exists (select 1 from home_sections h where h.title = v.title);

-- ── 12. Туршилтын хэрэглэгчид ──────────────────────────────────────────────
--
-- ⚠️ ХИЙМЭЛ. Утас нь 9900000X, и-мэйл нь phone auth-ийн синтетик домэйн
--    (`@phone.vonscent.mn`) — гаднаас хүрэх боломжгүй.
--
-- `auth.users`-ийн бүтэц Supabase-ийн хувилбараас хамаарч өөрчлөгддөг тул
-- бүхэлдээ exception-той блок дотор: бүтэлгүйтвэл каталогийн дата бүтэн
-- үлдэж, зөвхөн санамж хэвлэгдэнэ.
--
-- НЭВТРЭХ ТУХАЙ: сайт нь утас + 4 оронтой passcode-оор нэвтэрдэг, харин
-- Supabase дахь нууц үг нь `HMAC-SHA256(AUTH_PASSCODE_PEPPER, passcode)`
-- (src/lib/auth/phone.ts:36). Pepper нь орчны нууц тул ЭНД БИЧИХГҮЙ.
-- Passcode-оор нэвтрэх шаардлагатай бол seed-ийн дараа §12.1-ийг ажиллуул.
do $$
declare
  u_customer uuid := '00000000-0000-4000-8000-000000000001';
  u_operator uuid := '00000000-0000-4000-8000-000000000002';
  u_admin    uuid := '00000000-0000-4000-8000-000000000003';
  u_courier  uuid := '00000000-0000-4000-8000-000000000004';
  r record;
begin
  for r in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, '99000001', 'Тест Худалдан авагч', 'customer'),
      ('00000000-0000-4000-8000-000000000002'::uuid, '99000002', 'Тест Оператор',       'operator'),
      ('00000000-0000-4000-8000-000000000003'::uuid, '99000003', 'Тест Админ',          'super_admin'),
      ('00000000-0000-4000-8000-000000000004'::uuid, '99000004', 'Тест Хүргэгч',        'courier')
    ) as t(id, phone, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.phone || '@phone.vonscent.mn',
      -- Санамсаргүй нууц үг: passcode-оор нэвтрэхэд ХҮЧИНГҮЙ (§12.1 үзнэ үү).
      extensions.crypt(encode(extensions.gen_random_bytes(18), 'hex'), extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      '', '', '', ''
    )
    on conflict (id) do nothing;

    -- `on_auth_user_created` trigger profiles-ийг автоматаар үүсгэсэн (0005).
    -- Эрх, утас, оноог нь тохируулна; `profiles_role_claim` trigger нь эрхийг
    -- JWT-ийн `app_metadata.user_role` руу тусгана (0054b).
    update profiles
       set full_name = r.full_name,
           phone = r.phone,
           phone_verified = true,
           role = r.role::user_role
     where id = r.id;
  end loop;

  -- Хаяг (зөвхөн худалдан авагчид). `addresses` нь uuid PK-тай тул
  -- шошгоор нь шалгаж давхардлаас сэргийлнэ.
  insert into addresses (user_id, label, recipient, phone, city, district, detail, is_default)
  select v.uid, v.label, v.recipient, v.phone, v.city, v.district, v.detail, v.is_default
  from (values
    (u_customer, 'Гэр',  'Тест Худалдан авагч', '99000001', 'Улаанбаатар', 'Сүхбаатар', '1-р хороо, Тест гудамж 1, 101 тоот', true),
    (u_customer, 'Ажил', 'Тест Худалдан авагч', '99000001', 'Улаанбаатар', 'Чингэлтэй', '4-р хороо, Тест оффис, 5 давхар', false)
  ) as v(uid, label, recipient, phone, city, district, detail, is_default)
  where not exists (
    select 1 from addresses a where a.user_id = v.uid and a.label = v.label
  );

  -- Хүслийн жагсаалт.
  insert into wishlists (user_id, product_id)
  select u_customer, p.id from products p
   where p.slug in ('noctis-midnight-oud', 'lumen-vanilla-dust')
  on conflict do nothing;

  -- Үнэлгээ (rating trigger нь products.rating_avg/count-ыг өөрөө шинэчилнэ, 0070).
  insert into reviews (product_id, user_id, rating, body)
  select p.id, v.uid, v.rating, v.body
  from (values
    ('aurelia-golden-hour', u_customer, 5, 'Удаан тогтож байна. Оройдоо хамгийн сайн.'),
    ('aurelia-white-linen', u_customer, 4, 'Оффист таатай, гэхдээ надад хэтэрхий хөнгөн.'),
    ('noctis-velvet-rose',  u_operator, 5, 'Сарнай нь чихэрлэг биш — яг хүссэн шинж.'),
    ('lumen-citrus-salt',   u_operator, 3, 'Сэрүүн ч 3 цагийн дараа бараг мэдрэгдэхээ болино.')
  ) as v(slug, uid, rating, body)
  join products p on p.slug = v.slug
  on conflict do nothing;

  -- Оноо (loyalty) — нээгдсэн ба хүлээгдэж байгаа хоёуланг нь.
  -- uuid PK тул шалтгаанаар нь шалгана.
  insert into loyalty_ledger (user_id, delta, reason, available_at, released)
  select v.uid, v.delta, v.reason, v.available_at, v.released
  from (values
    (u_customer,  2500, 'Захиалгын оноо (туршилт)',          now() - interval '20 days', true),
    (u_customer,  1200, 'Захиалгын оноо (хүлээгдэж байна)',  now() + interval '10 days', false),
    (u_customer, -1000, 'Оноо зарцуулав (туршилт)',          now() - interval '5 days',  true)
  ) as v(uid, delta, reason, available_at, released)
  where not exists (
    select 1 from loyalty_ledger l where l.user_id = v.uid and l.reason = v.reason
  );

  update profiles set loyalty_points = 1500, pending_points = 1200 where id = u_customer;

  -- Захиалга — админы дэлгэц, төлөв шилжилтийг туршихад.
  insert into orders (
    id, user_id, status, payment_method, payment_status,
    contact_name, contact_phone, contact_email,
    ship_city, ship_district, ship_detail, ship_zone,
    subtotal, shipping_fee, discount, loyalty_used, total, note
  ) values
    ('00000000-0000-4000-9000-000000000001', u_customer, 'pending', 'qpay', 'unpaid',
     'Тест Худалдан авагч', '99000001', null,
     'Улаанбаатар', 'Сүхбаатар', '1-р хороо, Тест гудамж 1, 101 тоот', 'zone-1',
     104000, 0, 0, 0, 104000, 'Туршилтын захиалга — хүлээгдэж байна'),
    ('00000000-0000-4000-9000-000000000002', u_customer, 'delivered', 'qpay', 'paid',
     'Тест Худалдан авагч', '99000001', null,
     'Улаанбаатар', 'Чингэлтэй', '4-р хороо, Тест оффис, 5 давхар', 'zone-1',
     68000, 5000, 6800, 1000, 65200, 'Туршилтын захиалга — хүргэгдсэн')
  on conflict (id) do nothing;

  insert into order_items (order_id, product_id, variant_id, product_name, brand, ml, unit_price, qty, line_total)
  select v.order_id, p.id, pv.id, p.name, p.brand, v.ml, pv.price, v.qty, pv.price * v.qty
  from (values
    ('00000000-0000-4000-9000-000000000001'::uuid, 'aurelia-golden-hour', 10, 1),
    ('00000000-0000-4000-9000-000000000001'::uuid, 'noctis-velvet-rose',  5,  1),
    ('00000000-0000-4000-9000-000000000002'::uuid, 'aurelia-golden-hour', 10, 1)
  ) as v(order_id, slug, ml, qty)
  join products p on p.slug = v.slug
  join product_variants pv on pv.product_id = p.id and pv.ml = v.ml
  where not exists (select 1 from order_items oi where oi.order_id = v.order_id and oi.variant_id = pv.id);

  -- Имэйл захиалга (newsletter).
  insert into newsletter_subscribers (email, user_id, is_active)
  values ('99000001@phone.vonscent.mn', u_customer, true)
  on conflict do nothing;

exception when others then
  raise notice 'Хэрэглэгчийн seed алгаслаа: %', sqlerrm;
  raise notice 'Каталогийн дата бүтэн. auth.users-ийн бүтэц Supabase-ийн хувилбараас хамаарна.';
end $$;

commit;

-- ── 12.1. (Сонголт) Passcode-оор нэвтрэх ────────────────────────────────────
--
-- Дээрх хэрэглэгчид санамсаргүй нууц үгтэй тул НЭВТЭРЧ ЧАДАХГҮЙ. Сайтын
-- утас+passcode нэвтрэлтийг туршихын тулд preview-ийн AUTH_PASSCODE_PEPPER-ээ
-- тавиад доорхийг ажиллуул (pepper-ыг файлд БИТГИЙ бич):
--
--   psql "$DATABASE_URL" \
--     -v pepper="$(node --env-file=.env.von.dev -e \
--        'process.stdout.write(process.env.AUTH_PASSCODE_PEPPER)')" <<'SQL'
--   update auth.users
--      set encrypted_password = extensions.crypt(
--            encode(extensions.hmac('1234', :'pepper', 'sha256'), 'hex'),
--            extensions.gen_salt('bf'))
--    where email like '990000%@phone.vonscent.mn';
--   SQL
--
-- Үүний дараа: утас 99000001-99000004, passcode 1234.
--   99000001 → customer · 99000002 → operator
--   99000003 → super_admin · 99000004 → courier
