-- Арга хэмжээ: сайтын дээд гүйдэг зурвасын өнгө (studio-ux.md §5.3).
--
-- `ticker_theme` — бэлэн өнгөний түлхүүр (src/lib/constants.ts
-- `SALE_EVENT_TICKER_THEMES`); дурын hex биш тул бичиг үргэлж уншигдана.
-- null → кодын өгөгдмөл (`navy`).
--
-- Expand only: nullable багана; `save_sale_event` нь `tickerTheme` түлхүүрийг
-- ирсэн үед л бичнэ (хуучин код илгээхгүй → хуучин утга хэвээр);
-- `live_sale_events()`-ийн буцаах мөрөнд шинэ багана (хуучин код үл тоомсорлоно).
-- Туг: `sale_events` — шалгалтууд өмнөх шигээ (хаалттай бол юу ч бичигдэхгүй).

alter table sale_events
  add column if not exists ticker_theme text
  check (ticker_theme is null
         or ticker_theme in ('navy', 'black', 'gold', 'red', 'ivory', 'blue'));

------------------------------------------------------------------------------
-- save_sale_event — 0184-ийн хувилбар + ticker_theme.
------------------------------------------------------------------------------

create or replace function save_sale_event(
  p_id uuid,
  p_data jsonb,
  p_items jsonb,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_ended boolean;
begin
  if not feature_enabled('sale_events') then
    raise exception 'FEATURE_DISABLED';
  end if;

  if v_id is not null then
    select is_active and ends_at <= now()
      into v_ended
      from sale_events
     where id = v_id
       for update;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
    if v_ended then
      raise exception 'EVENT_ENDED';
    end if;
  end if;

  update sale_events o
     set slug = left(o.slug, 50) || '-'
                || to_char(o.starts_at at time zone 'Asia/Ulaanbaatar', 'YYYY')
                || case when exists (
                     select 1 from sale_events z
                      where z.slug = left(o.slug, 50) || '-'
                            || to_char(o.starts_at at time zone 'Asia/Ulaanbaatar', 'YYYY'))
                   then '-' || left(o.id::text, 4) else '' end
   where o.slug = p_data->>'slug'
     and o.id is distinct from v_id
     and o.is_active
     and o.ends_at <= now();

  if v_id is null then
    insert into sale_events (slug, name, badge_label, headline, description,
                             starts_at, ends_at, is_active, show_countdown,
                             ticker_theme, created_by)
    values (p_data->>'slug', p_data->>'name',
            nullif(btrim(p_data->>'badgeLabel'), ''),
            nullif(btrim(p_data->>'headline'), ''),
            nullif(btrim(p_data->>'description'), ''),
            (p_data->>'startsAt')::timestamptz,
            (p_data->>'endsAt')::timestamptz,
            coalesce((p_data->>'isActive')::boolean, false),
            coalesce((p_data->>'showCountdown')::boolean, true),
            nullif(p_data->>'tickerTheme', ''),
            p_user)
    returning id into v_id;
  else
    update sale_events
       set slug = p_data->>'slug',
           name = p_data->>'name',
           badge_label = nullif(btrim(p_data->>'badgeLabel'), ''),
           headline = nullif(btrim(p_data->>'headline'), ''),
           description = nullif(btrim(p_data->>'description'), ''),
           starts_at = (p_data->>'startsAt')::timestamptz,
           ends_at = (p_data->>'endsAt')::timestamptz,
           is_active = coalesce((p_data->>'isActive')::boolean, false),
           show_countdown = coalesce((p_data->>'showCountdown')::boolean, true),
           -- Түлхүүр ирээгүй (хуучин код) бол хөндөхгүй.
           ticker_theme = case when p_data ? 'tickerTheme'
                               then nullif(p_data->>'tickerTheme', '')
                               else ticker_theme end
     where id = v_id;
  end if;

  delete from sale_event_products where event_id = v_id;

  insert into sale_event_products (event_id, product_id, sort_order)
  select v_id, (it.x->>'productId')::uuid, it.ord::int
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
         with ordinality as it(x, ord);

  insert into sale_event_discounts (event_id, product_id, ml, pct)
  select v_id, (it.x->>'productId')::uuid, pc.key::int, pc.value::numeric::smallint
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it(x)
    cross join lateral jsonb_each_text(coalesce(it.x->'pcts', '{}'::jsonb)) pc
   where pc.value is not null and pc.value <> '';

  set constraints sale_events_no_overlap, sale_event_products_no_overlap immediate;

  return v_id;
end;
$$;

revoke all on function save_sale_event(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function save_sale_event(uuid, jsonb, jsonb, uuid) to service_role;

------------------------------------------------------------------------------
-- live_sale_events — буцаах мөрөнд ticker_theme (буцаах төрөл өөрчлөгдсөн тул
-- drop + create; эрхийг 0181-ийнхтэй ижил дахин олгоно).
------------------------------------------------------------------------------

drop function if exists live_sale_events();

create function live_sale_events()
returns table (
  slug           text,
  name           text,
  badge_label    text,
  headline       text,
  description    text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  show_countdown boolean,
  product_ids    uuid[],
  ticker_theme   text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.slug, e.name, e.badge_label, e.headline, e.description,
         e.starts_at, e.ends_at, e.show_countdown,
         coalesce(array(
           select p.product_id
             from sale_event_products p
            where p.event_id = e.id
            order by p.sort_order, p.product_id
         ), '{}'),
         e.ticker_theme
    from sale_events e
   where feature_enabled('sale_events')
     and e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at
   order by e.ends_at, e.name;
$$;

revoke all on function live_sale_events() from public;
grant execute on function live_sale_events() to anon, authenticated, service_role;
