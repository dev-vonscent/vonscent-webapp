-- «Захиалагдсан (түгжигдсэн) мл ямар захиалганд байгаа вэ» (backlog §2.4).
--
-- `inventory.reserved_ml` нь зөвхөн ТОО — «+40ml захиалагдсан» гэж харагддаг
-- ч аль захиалга түүнийг барьж байгааг харах арга байгаагүй. Oversell
-- хориотой загварт энэ нь операторын хамгийн магадлалтай асуулт: «яагаад
-- зарах мл алга байна?»
--
-- Нөөц барьж буй захиалга гэж юу вэ (кодоос гарсан тодорхойлолт):
--   • `place_order` нь мөр бүрийг reserve хийж, захиалгыг pending/unpaid-аар
--     үүсгэнэ;
--   • `mark_order_paid` нь commit хийнэ — reserved БА on_hand хоёулаа буурч,
--     нөөц дуусна;
--   • цуцлалт (`update_order_status`, `release_expired_reserves`) нь release
--     хийнэ.
-- Тиймээс нөөц барьж буй захиалга = `payment_status = 'unpaid'` ба
-- `status <> 'cancelled'`. `status` -ыг pending-ээр хязгаарлаагүй нь зориуд:
-- оператор төлөгдөөгүй захиалгыг гараар «баталгаажсан» болговол нөөц нь
-- ХЭВЭЭР үлддэг тул тийм захиалга энэ дэлгэцээс унах ёсгүй.
--
-- Функц нь `inventory.reserved_ml` (тоолуур) ба захиалгуудаас тоолсон дүн
-- хоёрыг ЗЭРЭГ буцаана. Хоёр нь зөрөх нь өөрөө мэдээлэл: зөрүү гарвал
-- тоолуур бодит захиалгаас тасарсан гэсэн үг (жишээ нь гараар засварласан,
-- эсвэл release/commit хосолсон алдаа) — дэлгэц түүнийг чангаар хэлнэ.

create or replace function admin_reserved_ml(p_product uuid default null)
returns table (
  product_id     uuid,
  product_name   text,
  brand          text,
  is_active      boolean,
  -- `inventory` дээрх тоолуур.
  reserved_ml    int,
  -- Нээлттэй захиалгуудын мөрөөс тоолсон дүн.
  accounted_ml   bigint,
  on_hand_ml     int,
  available_ml   int,
  order_count    bigint,
  -- Нөөцийн хугацаа нь аль хэдийн өнгөрсөн захиалгын тоо (cron авах ёстой).
  expired_count  bigint,
  orders         jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with open_orders as (
    -- Нэг захиалга нэг бараанаас хэд ч мөртэй байж болно (2мл + 10мл) —
    -- захиалгын түвшинд нийлбэрлэнэ.
    select
      i.product_id,
      o.id                 as order_id,
      o.order_no,
      o.status::text       as status,
      o.contact_name,
      o.contact_phone,
      o.created_at,
      o.reserve_expires_at,
      o.deliver_on,
      sum(i.ml * i.qty)::bigint as ml,
      -- Хугацаа дууссан эсэхийг САН шийднэ: вэб серверийн цаг өөр байж
      -- болох бөгөөд `release_expired_reserves` ч мөн санг цагаа гэж үздэг.
      (o.reserve_expires_at is not null and o.reserve_expires_at < now())
        as is_expired,
      -- Багц/бэлгийн мөрийг тусад нь харуулах шаардлагагүй ч «бэлэг ч
      -- нөөц иддэг» гэдгийг оператор мэдэх ёстой.
      bool_or(coalesce(i.is_gift, false)) as has_gift
    from order_items i
    join orders o on o.id = i.order_id
    where is_staff()
      and i.product_id is not null
      and o.payment_status = 'unpaid'
      and o.status <> 'cancelled'
      and (p_product is null or i.product_id = p_product)
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9
  ),
  per_product as (
    select
      l.product_id,
      sum(l.ml)::bigint  as accounted_ml,
      count(*)::bigint   as order_count,
      count(*) filter (where l.is_expired)::bigint as expired_count,
      jsonb_agg(
        jsonb_build_object(
          'order_id',           l.order_id,
          'order_no',           l.order_no,
          'status',             l.status,
          'contact_name',       l.contact_name,
          'contact_phone',      l.contact_phone,
          'created_at',         l.created_at,
          'reserve_expires_at', l.reserve_expires_at,
          'deliver_on',         l.deliver_on,
          'ml',                 l.ml,
          'has_gift',           l.has_gift,
          'is_expired',         l.is_expired
        )
        -- Хугацаа нь дуусах гэж буй нь эхэндээ: оператор эхлээд тэдгээрийг
        -- хардаг. `reserve_expires_at` null (гараар баталгаажуулсан) нь
        -- хойно.
        order by l.reserve_expires_at asc nulls last, l.created_at asc
      ) as orders
    from open_orders l
    group by 1
  )
  select
    p.id,
    p.name,
    p.brand,
    p.is_active,
    coalesce(inv.reserved_ml, 0),
    coalesce(pp.accounted_ml, 0),
    coalesce(inv.on_hand_ml, 0),
    coalesce(inv.available_ml, 0),
    coalesce(pp.order_count, 0),
    coalesce(pp.expired_count, 0),
    coalesce(pp.orders, '[]'::jsonb)
  from products p
  left join inventory  inv on inv.product_id = p.id
  left join per_product pp on pp.product_id = p.id
  where is_staff()
    and (p_product is null or p.id = p_product)
    -- Зөрүүтэй мөр ч (тоолуур 0 биш атлаа захиалга алга, эсвэл эсрэгээр)
    -- харагдах ёстой — яг тэр нь хайж буй зүйл.
    and (coalesce(inv.reserved_ml, 0) > 0 or coalesce(pp.accounted_ml, 0) > 0)
  order by coalesce(inv.reserved_ml, 0) desc, p.brand, p.name;
$$;

revoke all on function admin_reserved_ml(uuid) from public;
grant execute on function admin_reserved_ml(uuid) to authenticated;

-- Нээлттэй (төлөгдөөгүй, цуцлагдаагүй) захиалгыг хурдан олох индекс.
create index if not exists orders_open_reserve_idx
  on orders (payment_status, status)
  where payment_status = 'unpaid';
