-- Гар хямдрал ⇄ арга хэмжээ: нэг бараа хугацаа давхцсан хоёуланд орохгүй
-- (клиентийн засвар 2026-11-21 сл.10, шийдвэр B).
--
-- Өмнө нь гар хямдрал зөвхөн өөр гар хямдралтай (save_sale 16.3), арга
-- хэмжээ зөвхөн өөр арга хэмжээтэй (0181 EVENT_OVERLAP) давхцахаа шалгадаг
-- байв. Хоёр төрөл нэг бараанд зэрэг орвол үнэ нь `least()`-ээр зөв ч
-- chip («Black Friday 30%» — гэтэл 30% нь гар хямдралынх), тоолуур, задаргаа
-- зөрдөг. Одооноос БАРААГААР (хэмжээгээр биш) хориглоно:
--
--   · Гар хямдрал талд — `product_variants`-ийн statement trigger: хямдралын
--     багана (sale_price / хугацаа) өөрчлөгдсөн мөр бүрийг шалгана. Ингэснээр
--     `save_sale`, `apply_bulk_sale`, барааны засварын хуудас гурвуулаа
--     хамрагдана. Алдаа нь `save_sale`-ийн хуучин `SALE_CONFLICT` хэлбэртэй
--     ([{productId, sale}]) тул админы засварлагч бараа бүрийг улаанаар
--     «— «Black Friday»» гэж тэмдэглэнэ.
--   · Арга хэмжээ талд — одоо байгаа deferred constraint trigger-ууд
--     (`sale_events_no_overlap`, `sale_event_products_no_overlap`)-ийн
--     функцэд нэг шалгалт нэмнэ (`EVENT_MANUAL_OVERLAP`, `OverlapConflict`
--     хэлбэр). `save_sale_event` төгсгөлдөө тэднийг `immediate` болгодог тул
--     өөрчлөх шаардлагагүй.
--
-- Тооцох мөр: идэвхтэй (is_active), дуусаагүй (ends_at > now()) арга хэмжээ;
-- дуусаагүй гар хямдрал. Туг `sale_events` хаалттай бол арга хэмжээ үнэд
-- нөлөөлдөггүй тул шалгахгүй. Дууссан / зогсоосон арга хэмжээг шалгахгүй тул
-- `stop_sale_event` хуучин давхцалтай өгөгдөл дээр ч ажилласаар.
--
-- Хуучин давхцал (энэ migration-аас өмнөх) устахгүй — хямдралын багана нь
-- өөрчлөгдөөгүй мөр, хугацаа / төлөв нь өөрчлөгдөөгүй арга хэмжээ
-- шалгагдахгүй (нэр, текст засаж болно). Харагдац нь A шийдвэрээр (chip нь
-- үнийг бодитоор тогтоож буй хямдралаас) зөв гарна. Prod-д ажиллуулахын
-- өмнө одоогийн давхцлыг доорх query-гээр харж болно:
--
--   select pr.brand, pr.name, e.name as event, coalesce(s.name, 'Нэргүй') as sale
--     from sale_events e
--     join sale_event_products p on p.event_id = e.id
--     join product_variants v on v.product_id = p.product_id
--     join products pr on pr.id = p.product_id
--     left join sales s on s.id = v.sale_id
--    where e.is_active and e.ends_at > now() and v.is_active
--      and v.sale_price < v.price
--      and (v.sale_ends_at is null or v.sale_ends_at > now())
--      and e.starts_at < coalesce(v.sale_ends_at, 'infinity')
--      and coalesce(v.sale_starts_at, '-infinity') < e.ends_at
--    group by 1, 2, 3, 4;
--
-- Expand only: шинэ функц, шинэ trigger, хуучин trigger функцийн бие.

------------------------------------------------------------------------------
-- 1. Гар хямдрал талд
------------------------------------------------------------------------------

create or replace function sale_manual_event_conflicts(p_rows jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- p_rows: [{product_id, starts_at, ends_at}] — шинэ гар хямдралын хугацаа.
  select jsonb_agg(distinct jsonb_build_object(
           'productId', r.product_id, 'sale', e.name))
    from jsonb_to_recordset(p_rows)
           as r(product_id uuid, starts_at timestamptz, ends_at timestamptz)
    join sale_event_products p on p.product_id = r.product_id
    join sale_events e on e.id = p.event_id
   where feature_enabled('sale_events')
     and e.is_active
     and e.ends_at > now()
     and e.starts_at < coalesce(r.ends_at, 'infinity'::timestamptz)
     and coalesce(r.starts_at, '-infinity'::timestamptz) < e.ends_at;
$$;

revoke all on function sale_manual_event_conflicts(jsonb) from public, anon, authenticated;

create or replace function trg_product_variants_event_exclusive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_conflicts jsonb;
begin
  -- Хямдралын багана нь өөрчлөгдсөн, идэвхтэй (дуусаагүй) гар хямдрал.
  if tg_op = 'INSERT' then
    select jsonb_agg(jsonb_build_object(
             'product_id', n.product_id,
             'starts_at', n.sale_starts_at,
             'ends_at', n.sale_ends_at))
      into v_rows
      from new_rows n
     where n.is_active
       and n.sale_price is not null
       and n.sale_price < n.price
       and (n.sale_ends_at is null or n.sale_ends_at > now());
  else
    select jsonb_agg(jsonb_build_object(
             'product_id', n.product_id,
             'starts_at', n.sale_starts_at,
             'ends_at', n.sale_ends_at))
      into v_rows
      from new_rows n
      join old_rows o on o.id = n.id
     where n.is_active
       and n.sale_price is not null
       and n.sale_price < n.price
       and (n.sale_ends_at is null or n.sale_ends_at > now())
       -- Хямдрал «идэвхжих» бүх өөрчлөлт: хямдралын багана, үндсэн үнэ
       -- (үнэ өсөхөд хуучин sale_price хямдрал болж сэргэнэ), хэмжээг
       -- идэвхжүүлэх.
       and (n.sale_price is distinct from o.sale_price
            or n.sale_starts_at is distinct from o.sale_starts_at
            or n.sale_ends_at is distinct from o.sale_ends_at
            or n.price is distinct from o.price
            or n.is_active is distinct from o.is_active);
  end if;

  if v_rows is null then
    return null;
  end if;

  v_conflicts := sale_manual_event_conflicts(v_rows);
  if v_conflicts is not null then
    raise exception 'SALE_CONFLICT'
      using errcode = 'exclusion_violation', detail = v_conflicts::text,
            hint = 'EVENT';
  end if;
  return null;
end;
$$;

drop trigger if exists product_variants_event_exclusive_ins on product_variants;
create trigger product_variants_event_exclusive_ins
  after insert on product_variants
  referencing new table as new_rows
  for each statement execute function trg_product_variants_event_exclusive();

drop trigger if exists product_variants_event_exclusive_upd on product_variants;
create trigger product_variants_event_exclusive_upd
  after update on product_variants
  referencing old table as old_rows new table as new_rows
  for each statement execute function trg_product_variants_event_exclusive();

------------------------------------------------------------------------------
-- 2. Арга хэмжээ талд
------------------------------------------------------------------------------

create or replace function sale_event_check_manual_overlap(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicts jsonb;
begin
  select jsonb_agg(c order by c->>'brand', c->>'product')
    into v_conflicts
    from (
      select distinct jsonb_build_object(
               'productId', pr.id,
               'product', pr.name,
               'brand', pr.brand,
               'event', coalesce(s.name, 'Нэргүй'),
               'startsAt', coalesce(v.sale_starts_at, s.starts_at, now()),
               'endsAt', coalesce(v.sale_ends_at, s.ends_at,
                                  'infinity'::timestamptz)) as c
        from sale_events e
        join sale_event_products p on p.event_id = e.id
        join product_variants v on v.product_id = p.product_id
        join products pr on pr.id = p.product_id
        left join sales s on s.id = v.sale_id
       where e.id = p_event
         and feature_enabled('sale_events')
         and e.is_active
         and e.ends_at > now()
         and v.is_active
         and v.sale_price is not null
         and v.sale_price < v.price
         and (v.sale_ends_at is null or v.sale_ends_at > now())
         and e.starts_at < coalesce(v.sale_ends_at, 'infinity'::timestamptz)
         and coalesce(v.sale_starts_at, '-infinity'::timestamptz) < e.ends_at
    ) x;
  if v_conflicts is not null then
    raise exception 'EVENT_MANUAL_OVERLAP'
      using errcode = 'exclusion_violation', detail = v_conflicts::text;
  end if;
end;
$$;

revoke all on function sale_event_check_manual_overlap(uuid) from public, anon, authenticated;

-- 0190-ийн бие + гар хямдралын шалгалт. `save_sale_event` хадгалах бүрт
-- хугацаа / төлвийг SET хийдэг тул гар хямдралын шалгалт зөвхөн тэд
-- БОДИТООР өөрчлөгдсөн (эсвэл шинэ) үед — хуучин давхцалтай live арга
-- хэмжээний нэр, текстийг засаж болно.
create or replace function trg_sale_events_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_overlap(new.id);
  perform sale_event_check_bundle_overlap(new.id);
  if tg_op = 'INSERT'
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.is_active is distinct from old.is_active then
    perform sale_event_check_manual_overlap(new.id);
  end if;
  return null;
end $$;

-- 0181-ийн бие + гар хямдралын шалгалт — зөвхөн ШИНЭ гишүүн (merge
-- хадгалалтын `on conflict do update set sort_order` нь UPDATE).
create or replace function trg_sale_event_products_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_overlap(new.event_id);
  if tg_op = 'INSERT' then
    perform sale_event_check_manual_overlap(new.event_id);
  end if;
  return null;
end $$;
