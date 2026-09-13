-- Тайланг ДУРЫН огнооны мужаар харах (backlog §2.4).
--
-- Өмнө нь тайлангийн дөрвөн aggregate огт параметргүй байсан тул хуудас
-- зөвхөн «бүх цаг үе»-ийг л харуулж чаддаг байв; «энэ сар хэд зарсан бэ»
-- гэсэн асуултад хариулах арга байгаагүй. Дөрвүүлээ [p_from, p_to] мужийг
-- авдаг болов — хоёулаа `null` бол зан төлөв нь ЯГ хуучных (бүх цаг үе).
--
-- Хоёр зүйл зэрэг зассан:
--
-- 1. **Сарын бүлэглэлт цагийн бүсээ олов.** `to_char(created_at, 'YYYY-MM')`
--    нь серверийн бүсээр (Supabase дээр UTC) бүлэглэдэг байсан тул 9-р сарын
--    1-ний 03:00 (UB) -д төлөгдсөн захиалга 8-р сард тоологдож байв — сар
--    бүрийн зааг дээрх бүх захиалга буруу саранд. Одоо бүх бүлэглэлт
--    `at time zone 'Asia/Ulaanbaatar'` дээр хийгдэнэ.
--
-- 2. **Богино муж дээр сараар бүлэглэх нь утгагүй.** 7 хоногийн тайлан нэг
--    баганатай график болдог. `p_bucket` нэмэгдэв: 'day' | 'month' — дуудагч
--    мужийнхаа уртаас шалтгаалж сонгоно.
--
-- Зардлын тухай: муж өгөгдсөн үед зардал нь ТЭР МУЖИД хийгдсэн хөрөнгө
-- оруулалт — тухайн мужид бүртгэгдсэн барааны эх савны үнэ + тэр мужид
-- хийгдсэн restock-ийн өртөг. Мужгүй үед хуучнаараа бүгд.

-- Хуучин гарын үсгүүдийг устгана: `p_from` зэрэг default-тай шинэ хувилбар
-- нь тэдгээртэй зэрэгцвэл дуудлага хоёрдмол утгатай болно (PostgREST
-- «could not choose the best candidate function» гэж унана).
drop function if exists admin_report_totals();
drop function if exists admin_report_monthly();
drop function if exists admin_report_top_products(int);
drop function if exists admin_report_top_brands();

create or replace function admin_report_totals(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (total_revenue bigint, paid_orders bigint, total_cost bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- `is_staff()` нь дэд асуулга бүрт: SECURITY DEFINER нь RLS-ийг алгасдаг
  -- бөгөөд `authenticated` дотор энгийн худалдан авагч ч багтана.
  select
    coalesce((
      select sum(greatest(subtotal - discount - coalesce(loyalty_used, 0), 0))
      from orders
      where payment_status = 'paid' and is_staff()
        and (p_from is null or created_at >= p_from)
        and (p_to   is null or created_at <= p_to)
    ), 0)::bigint,
    coalesce((
      select count(*) from orders
      where payment_status = 'paid' and is_staff()
        and (p_from is null or created_at >= p_from)
        and (p_to   is null or created_at <= p_to)
    ), 0)::bigint,
    (coalesce((
       select sum(bottle_price) from products
       where is_staff()
         and (p_from is null or created_at >= p_from)
         and (p_to   is null or created_at <= p_to)
     ), 0)
     + coalesce((
       select sum(cost) from restock_log
       where is_staff()
         and (p_from is null or created_at >= p_from)
         and (p_to   is null or created_at <= p_to)
     ), 0))::bigint;
$$;

create or replace function admin_report_series(
  p_from   timestamptz default null,
  p_to     timestamptz default null,
  p_bucket text default 'month'
)
returns table (bucket text, revenue bigint, orders bigint, ml bigint)
language sql
stable
security definer
set search_path = public
as $$
  with paid as (
    select id, created_at,
           greatest(subtotal - discount - coalesce(loyalty_used, 0), 0) as rev
    from orders
    where payment_status = 'paid' and is_staff()
      and (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <= p_to)
  ),
  -- Тэр хугацаанд эх савнаас гарсан мл — мөрүүдээс тоологдоно.
  sold as (
    select o.id, sum(i.ml * i.qty) as ml
    from paid o join order_items i on i.order_id = o.id
    group by o.id
  )
  select to_char(
           p.created_at at time zone 'Asia/Ulaanbaatar',
           case when p_bucket = 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end
         ),
         sum(p.rev)::bigint,
         count(*)::bigint,
         coalesce(sum(s.ml), 0)::bigint
  from paid p left join sold s on s.id = p.id
  group by 1
  order by 1 desc;
$$;

create or replace function admin_report_top_products(
  p_limit int default 10,
  p_from  timestamptz default null,
  p_to    timestamptz default null
)
returns table (name text, brand text, qty bigint, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.product_name, i.brand, sum(i.qty)::bigint, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <= p_to)
  group by i.product_name, i.brand
  order by 4 desc
  limit p_limit;
$$;

create or replace function admin_report_top_brands(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (brand text, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.brand, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <= p_to)
  group by i.brand
  order by 2 desc;
$$;

-- Захиалгын төлвийн тоолуур ч мужаас хамаарна: тайлан дээрх бялуу нь
-- дээрх тоонуудтай нэг хугацааны тухай байх ёстой. `admin_report_status`
-- нь самбарынхаас (getDashboardData) тусдаа — самбар үргэлж «бүх цаг үе».
create or replace function admin_report_status(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (status text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.status::text, count(*)::bigint
  from orders o
  where is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <= p_to)
  group by 1;
$$;

revoke all on function admin_report_totals(timestamptz, timestamptz) from public;
revoke all on function admin_report_series(timestamptz, timestamptz, text) from public;
revoke all on function admin_report_top_products(int, timestamptz, timestamptz) from public;
revoke all on function admin_report_top_brands(timestamptz, timestamptz) from public;
revoke all on function admin_report_status(timestamptz, timestamptz) from public;
grant execute on function admin_report_totals(timestamptz, timestamptz) to authenticated;
grant execute on function admin_report_series(timestamptz, timestamptz, text) to authenticated;
grant execute on function admin_report_top_products(int, timestamptz, timestamptz) to authenticated;
grant execute on function admin_report_top_brands(timestamptz, timestamptz) to authenticated;
grant execute on function admin_report_status(timestamptz, timestamptz) to authenticated;

-- Мужаар шүүх нь `orders.created_at` дээр индекс шаардана; төлбөрийн төлөв нь
-- хамгийн сонгомол багана тул хосоор нь.
create index if not exists orders_paid_created_idx
  on orders (payment_status, created_at desc);
