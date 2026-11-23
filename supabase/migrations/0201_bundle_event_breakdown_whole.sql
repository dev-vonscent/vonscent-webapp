-- Багцын арга хэмжээний задаргаа: хэмнэлт БҮХЭЛДЭЭ event-ийн мөрөнд.
--
-- 0190 нь event-д орсон багцын хэмнэлтийг хоёр хуваадаг байв:
-- «Багцын хямдрал» (суурь 5%) + «Black Friday» (нэмэлт 5%). Event хувь суурийг
-- ОРЛОДОГ (нэмэгддэггүй) тул энэ нь 5% + 5% давхарласан мэт харагдаж,
-- барааны дүрэмтэй (`variant_sale_label` — ялсан хямдрал ганц мөр) зөрдөг.
--
-- Шинэ дүрэм: event үйлчилж байгаа (суурь хувиар бодсон үнээс хямд) багцын
-- хэмжээнд хэмнэлт бүхэлдээ (гишүүдийн үндсэн нийлбэр − төлсөн) «<Event нэр>»
-- мөр болно → `gross_subtotal` − `subtotal` = 0 тул «Багцын хямдрал» гарахгүй.
-- Event-гүй / үйлчлэхгүй үед мөргүй → өмнөх шиг «Багцын хямдрал».
-- TS `bundleEventSaving` (src/features/collections/pricing.ts)-тэй ижил томьёо.
--
-- Expand only: зөвхөн функцийн бие. `order_apply_price_breakdown` хөндөхгүй.
-- Өмнө үүссэн захиалгын `sale_breakdown` өөрчлөгдөхгүй.

create or replace function order_bundle_event_rows(p_order uuid)
returns table (label text, amount bigint)
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select coalesce((select (value->>'roundTo')::int from settings
                      where key = 'collection'), 100) as step
  ), b as (
    select i.collection_id, i.ml, i.qty,
           sum(i.base_price)::bigint as member_sum,
           sum(i.unit_price)::bigint as paid
      from order_items i
     where i.order_id = p_order
       and i.line_kind = 'perfume'
       and not i.is_gift
       and i.collection_id is not null
       and i.base_price is not null
     group by i.collection_id, i.ml, i.qty
  ), r as (
    select ev.event_name as label,
           case
             when b.paid < collection_bundle_price(b.member_sum,
                             collection_base_pct(b.collection_id, b.ml), st.step)
               then greatest(b.member_sum - b.paid, 0)
             else 0
           end * b.qty as amount
      from b
      cross join st
      join live_event_collection_discounts() ev
        on ev.collection_id = b.collection_id and ev.ml = b.ml
  )
  select r.label, sum(r.amount)::bigint from r where r.amount > 0 group by r.label;
$$;

revoke all on function order_bundle_event_rows(uuid) from public, anon, authenticated;
grant execute on function order_bundle_event_rows(uuid) to service_role;
