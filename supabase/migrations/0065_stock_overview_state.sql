-- `admin_stock_overview()`-д ТӨЛӨВИЙН шүүлт нэмэх.
--
-- 0062 нь гурван дуудагчид (самбар, тайлан, хэвлэх) НЭГ эрэмбэлэгдсэн жагсаалт
-- буцаадаг байсан бөгөөд тэр нь тэднийг хангаж чадахгүй байв:
--
--   `order by available_ml` тул ДУУССАН бараа (available_ml <= 0) нь «бага»
--   бараа (available_ml > 0) БҮГДЭЭС өмнө эрэмбэлэгдэнэ. Самбар нь эхний 20
--   мөрийг аваад дундаас нь `state = 'low'`-г шүүдэг байсан — өөрөөр хэлбэл
--   дууссан бараа 20 болонгуут «Үлдэгдэл багатай» жагсаалт ХООСОН болж, дээрх
--   картан дээр «Үлдэгдэл багатай: 35» гэж бичсэн зэрэг «Сэрэмжлүүлэг алга.»
--   гэж уншигдана. Каталог 76 бараатай, дууссан нь 0 байсан тул харагдаагүй.
--
-- Одоо дуудагч бүр өөрт ХЭРЭГТЭЙ мөрийг л асууна, тиймээс хязгаар нь буруу
-- мөрөөр дүүрэх боломжгүй:
--
--   самбар : p_state => 'low'        (сэрэмжлүүлэг)
--   тайлан : p_state => null, p_active_only => true  (үлдэгдэл багатай эхний 10)
--   хэвлэх : p_state => 'attention'  (ok биш бүгд)
--
-- `matched_count` нь шүүлтэд таарсан БҮХ мөрийн тоо: хязгаар нь тасалсан эсэхийг
-- дуудагч мэдэж, дуугүй бага мөр харуулахын оронд хэлж чадна.
--
-- Тоолуурууд (total/low/soldout/total_available_ml) нь шүүлтээс ХАМААРАХГҮЙ —
-- тэд бүх каталогийн тухай баримт хэвээр байх ёстой.
--
-- Хуучин (int) хэлбэрийг УСТГАНА: PostgREST хоёр overload-ыг нэг нэрээр харвал
-- дуудлага хоёрдмол болно.

drop function if exists admin_stock_overview(int);

create or replace function admin_stock_overview(
  p_limit       int     default 50,
  -- null / '' = бүгд · 'low' · 'soldout' · 'attention' (= ok биш бүгд)
  p_state       text    default null,
  -- Нуусан барааг жагсаалтаас гаргах эсэх (тоолуурт нөлөөлөхгүй).
  p_active_only boolean default false
)
returns table (
  total_products     bigint,
  low_count          bigint,
  soldout_count      bigint,
  total_available_ml bigint,
  -- Шүүлтэд таарсан мөрийн БҮТЭН тоо (`items` нь үүний эхний p_limit).
  matched_count      bigint,
  items              jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  with s as (
    select
      pr.id, pr.name, pr.brand, pr.is_active,
      coalesce(inv.available_ml, 0) as available_ml,
      -- 0048-ын өгөгдмөл (DEFAULT_LOW_STOCK_ML = 50).
      coalesce(inv.low_stock_ml, 50) as low_stock_ml,
      case
        when coalesce(inv.available_ml, 0) <= 0 then 'soldout'
        when coalesce(inv.available_ml, 0) <= coalesce(inv.low_stock_ml, 50) then 'low'
        else 'ok'
      end as state
    from products pr
    left join inventory inv on inv.product_id = pr.id
  ),
  m as (
    select * from s
     where (not coalesce(p_active_only, false) or is_active)
       and case coalesce(p_state, '')
             when ''          then true
             when 'attention' then state <> 'ok'
             else state = p_state
           end
  )
  select
    (select count(*) from s),
    (select count(*) from s where state = 'low'),
    (select count(*) from s where state = 'soldout'),
    (select coalesce(sum(available_ml), 0)::bigint from s),
    (select count(*) from m),
    coalesce((
      select jsonb_agg(to_jsonb(x) order by x.available_ml, x.name)
        from (
          select id, name, brand, is_active, available_ml, low_stock_ml, state
            from m
           order by available_ml, name
           limit greatest(coalesce(p_limit, 50), 1)
        ) x
    ), '[]'::jsonb);
$$;

comment on function admin_stock_overview is
  'Үлдэгдлийн нэгдсэн тойм: бүх каталогийн тоонууд, ба p_state/p_active_only-д '
  'таарсан мөрийн тоо (matched_count) + үлдэгдэл багаас эрэмбэлсэн эхний '
  'p_limit мөр. Төлвийн дүрэм нь stock-state.ts-ийн 2 аргументтай хэлбэртэй ижил '
  '(inventory.is_sold_out-ыг админы бусад дэлгэцтэй адил уншдаггүй).';

revoke all on function admin_stock_overview(int, text, boolean) from public;
revoke execute on function admin_stock_overview(int, text, boolean) from anon;
grant execute on function admin_stock_overview(int, text, boolean) to authenticated;
