-- Арга хэмжээ + hero — review-ийн засвар (docs/campaigns/fixes.md F1, F5).
--
-- F1: Дууссан (үүнд зогсоосон) арга хэмжээг `save_sale_event` засахгүй —
--     `EVENT_ENDED`. Өмнө нь зогсоосон арга хэмжээг (`ends_at = 14:00`) нээгээд
--     хадгалахад маягтын «дуусах өдөр» → өдрийн төгсгөл болж, арга хэмжээ шөнө
--     дунд хүртэл дахин LIVE болдог байв. Дахин явуулах бол хуулна (p_id null).
-- F5: `live_heroes()` — `live_hero()`-ийн ижил шүүлт/эрэмбэ, ихдээ 5 мөр.
--     Кэшлэгдсэн эхний hero дуусахад дараагийнх нь шууд гарна (кодын hero руу
--     унахгүй).
--
-- Expand only: `create or replace` (гарын үсэг хэвээр) + шинэ функц.
-- Туг: `sale_events`, `hero_admin` — шалгалтууд өмнөх шигээ.

------------------------------------------------------------------------------
-- F1. save_sale_event — дууссаныг засахгүй.
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

  -- Засах үед: мөрийг түгжээд дууссан эсэхийг шалгана (зогсоох ба хадгалах
  -- зэрэг ирэхэд race гарахгүй). Slug архивлахаас ӨМНӨ.
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

  -- Slug-ийг жил бүр дахин ашиглана (`black-friday`, §6.2): тэр slug ДУУССАН
  -- арга хэмжээнд байвал хуучныг `black-friday-2025` болгож архивлана. Явж
  -- буй / товлосон / ноорог дээр байвал unique алдаа (SLUG_TAKEN).
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
                             created_by)
    values (p_data->>'slug', p_data->>'name',
            nullif(btrim(p_data->>'badgeLabel'), ''),
            nullif(btrim(p_data->>'headline'), ''),
            nullif(btrim(p_data->>'description'), ''),
            (p_data->>'startsAt')::timestamptz,
            (p_data->>'endsAt')::timestamptz,
            coalesce((p_data->>'isActive')::boolean, false),
            coalesce((p_data->>'showCountdown')::boolean, true),
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
           show_countdown = coalesce((p_data->>'showCountdown')::boolean, true)
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

  -- Давхцлыг эцсийн төлөв дээр, функц дотроо шалгана — алдаа commit-ийн үед
  -- биш, энэ дуудлагын хариунд ирнэ.
  set constraints sale_events_no_overlap, sale_event_products_no_overlap immediate;

  return v_id;
end;
$$;

revoke all on function save_sale_event(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function save_sale_event(uuid, jsonb, jsonb, uuid) to service_role;

------------------------------------------------------------------------------
-- F5. live_heroes() — дэлгүүрийн кэш жагсаалт авна.
------------------------------------------------------------------------------

create or replace function live_heroes()
returns table (
  id                 uuid,
  eyebrow            text,
  title              text,
  description        text,
  mobile_description text,
  primary_label      text,
  primary_target     jsonb,
  secondary_label    text,
  secondary_target   jsonb,
  desktop_image      jsonb,
  mobile_image       jsonb,
  image_alt          text,
  dark               boolean,
  starts_at          timestamptz,
  ends_at            timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with live_events as (
    select e.id, e.slug, e.starts_at, e.ends_at
      from sale_events e
     where feature_enabled('sale_events')
       and e.is_active
       and e.starts_at <= now()
       and now() < e.ends_at
  )
  select h.id, h.eyebrow, h.title, h.description, h.mobile_description,
         h.primary_label, h.primary_target, h.secondary_label,
         h.secondary_target, h.desktop_image, h.mobile_image, h.image_alt,
         h.dark,
         coalesce(le.starts_at, h.starts_at),
         coalesce(le.ends_at, h.ends_at)
    from heroes h
    left join live_events le on le.id = h.sale_event_id
   where feature_enabled('hero_admin')
     and h.is_active
     and h.desktop_image is not null
     and h.mobile_image is not null
     and case
           when h.sale_event_id is not null then le.id is not null
           else h.starts_at <= now() and now() < h.ends_at
         end
     and (h.primary_target->>'type' <> 'event'
          or exists (select 1 from live_events x
                      where x.slug = h.primary_target->>'slug'))
     and (h.secondary_target is null
          or h.secondary_target->>'type' <> 'event'
          or exists (select 1 from live_events x
                      where x.slug = h.secondary_target->>'slug'))
   order by h.priority desc, coalesce(le.starts_at, h.starts_at) desc, h.id
   limit 5;
$$;

revoke all on function live_heroes() from public;
grant execute on function live_heroes() to anon, authenticated, service_role;

comment on function live_heroes() is
  'Дэлгүүрт одоо гарах ёстой hero-ууд эрэмбээр (0184, ихдээ 5). Эхнийх = live_hero(). '
  'Кэшлэгдсэн эхнийх дуусахад дараагийнх нь гарна.';
