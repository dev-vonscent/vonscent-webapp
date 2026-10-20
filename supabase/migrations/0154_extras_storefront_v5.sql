-- Нэмэлт бараа v5 — дэлгүүр (extras-shop-plan §18.5; PR13). Feature flag:
-- `extras_shop` (хаалттай хэвээр).
--
-- 0148-ийн `extras_catalog()` / `extra_detail()`-д:
--   · `stock` — хэрэглэгчид харагдах үлдэгдэл («Үлдэгдэл: 6 ширхэг»);
--   · `bottle_ml` — хоосон/бүтэн шилний бүтэн хэмжээ («0/125ml», 0153 attrs);
--   · `notice`, `requires_consent` — ангилал+горимын анхааруулга (0153);
--   · хувилбарын batch code, хэмжээний тайлбар, зураг, савны өнгө/хэмжээ.
-- «Хэдэн шил багтах» (`capacity`) хасагдсан — клиент шаардаагүй (§18.4).
--
-- Буцаах төрөл өөрчлөгдөж буй тул drop → create. Дуудагчид (`global_search`,
-- `extras_leftover_for`) баганыг нэрээр уншдаг, хасагдсан `capacity`-г
-- ашигладаггүй. Prod-д 0148 хараахан ороогүй — хуучин код үүнийг дууддаггүй.

drop function if exists extra_detail(text);
drop function if exists extras_catalog();

create or replace function extras_catalog()
returns table (
  id uuid,
  slug text,
  name text,
  category_id uuid,
  category_slug text,
  category_name text,
  category_sort int,
  mode extra_inventory_mode_t,
  image_url text,
  images text[],
  bottle_ml int,
  sort int,
  from_price int,
  sold_out boolean,
  leftover_brand text,
  leftover_product text,
  remaining_ml int,
  full_ml int,
  created_at timestamptz,
  updated_at timestamptz,
  -- Зарагдах хувилбаруудын нийт үлдэгдэл; тоолж эхлээгүй сав байвал null.
  stock int,
  notice text,
  requires_consent boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.slug, p.name, c.id, c.slug, c.name, c.sort, p.inventory_mode,
    coalesce(p.images[1], lp.image) as image_url,
    p.images,
    case when jsonb_typeof(p.attrs->'bottle_ml') = 'number'
         then (p.attrs->>'bottle_ml')::int end,
    p.sort,
    -- Зарагдах хувилбарын хамгийн бага үнэ; бүгд дууссан бол идэвхтэй бүхний.
    coalesce(min(v.price) filter (where v.avail is null or v.avail > 0),
             min(v.price), 0)::int,
    not coalesce(bool_or(v.avail is null or v.avail > 0), false),
    lp.brand, lp.name, p.remaining_ml, p.full_ml,
    p.created_at, p.updated_at,
    case when bool_or(v.avail is null) then null
         else coalesce(sum(v.avail), 0) end::int,
    coalesce(m.notice, ''),
    coalesce(m.requires_consent, false)
  from extra_products p
  join extra_categories c on c.id = p.category_id and c.is_active
  left join extra_category_modes m
    on m.category_id = p.category_id and m.inventory_mode = p.inventory_mode
  left join lateral (
    select ev.price, extra_variant_available(ev) as avail
      from extra_variants ev
     where ev.extra_id = p.id and ev.is_active and ev.price > 0
  ) v on true
  left join lateral (
    select pr.brand, pr.name,
           (select pi.url from product_images pi
             where pi.product_id = pr.id and pi.is_visible
             order by pi.sort_order limit 1) as image
      from products pr where pr.id = p.product_id
  ) lp on true
  where feature_enabled('extras_shop')
    and p.status = 'published'
    -- Грамын сав нь савны тоон нөөцгүйгээр утгагүй.
    and (p.inventory_mode <> 'shared_vial' or feature_enabled('vial_inventory'))
  group by p.id, c.id, lp.brand, lp.name, lp.image, m.notice, m.requires_consent;
$$;

comment on function extras_catalog() is
  'Дэлгүүрийн нэмэлт барааны карт: хамгийн бага үнэ, үлдэгдэл, дууссан эсэх, '
  'анхааруулга. Туг extras_shop хаалттай бол хоосон.';

create or replace function extra_detail(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'card', to_jsonb(e),
    'description', p.description,
    'product_slug', (select pr.slug from products pr where pr.id = p.product_id),
    'product_id', p.product_id,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'label', v.label,
               'price', v.price,
               'available', extra_variant_available(v),
               'vial_style', vl.style,
               'vial_ml', vl.ml,
               'batch_code', v.batch_code,
               'size_note', v.size_note,
               'image_url', v.image_url
             ) order by v.sort, vl.ml, vl.style, v.label)
        from extra_variants v
        left join vials vl on vl.id = v.vial_id
       where v.extra_id = p.id and v.is_active and v.price > 0
    ), '[]'::jsonb)
  )
  from extras_catalog() e
  join extra_products p on p.id = e.id
  where e.slug = p_slug;
$$;

revoke all on function extras_catalog() from public;
revoke all on function extra_detail(text) from public;
grant execute on function extras_catalog() to anon, authenticated, service_role;
grant execute on function extra_detail(text) to anon, authenticated, service_role;
