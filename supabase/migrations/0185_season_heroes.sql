-- Улирлын нүүрний баннер (docs/campaigns/studio-ux.md D9, D10, §8.2).
--
-- Арга хэмжээ, тусгай өдөр байхгүй үед нүүр хуудсанд Хавар / Зун / Намар /
-- Өвлийн баннер өөрөө ээлжилнэ. Улирал бүрт ГАНЦ мөр, он байхгүй — жил бүр
-- давтагдана. Улирал зөвхөн эхлэх өдөртэй (`season_start_md`, 'MM-DD', УБ);
-- дараагийн БЭЛЭН улирал эхлэх хүртэл гарна → завсар, давхцал гарахгүй, зураг
-- бэлэн биш улирлыг өмнөх нь нөхнө.
--
-- Давхарга (дээрээс доош, эхний тохирох нь): арга хэмжээний баннер →
-- тусгай өдрийн баннер → улирлын баннер → кодын нөөц (HOME_CAMPAIGNS).
--
-- `product_ids` — баннерын зурган дээрх үнэртнүүд (ихдээ 3, D10 «үнэртэн солих»).
--
-- Expand only: nullable / өгөгдмөлтэй багана, check-ийг ӨРГӨТГӨНӨ (хуучин мөр
-- бүгд хүчинтэй), `create or replace` (гарын үсэг хэвээр), шинэ функц.
-- Хуучин код ажилласаар байна. Туг `hero_admin` — шинэ туг үгүй; хаалттай бол
-- `live_heroes()` хоосон, бичилт `FEATURE_DISABLED` (0182-ийн trigger).

------------------------------------------------------------------------------
-- 1. Багана, check.
------------------------------------------------------------------------------

alter table heroes add column if not exists season text;
alter table heroes add column if not exists season_start_md text;
alter table heroes add column if not exists product_ids uuid[] not null default '{}';

alter table heroes drop constraint if exists heroes_season_valid;
alter table heroes add constraint heroes_season_valid check (
  season is null or season in ('spring', 'summer', 'autumn', 'winter'));

-- Жил бүр байдаг өдөр л (02-29 биш — өндөр биш жилд алга болно).
alter table heroes drop constraint if exists heroes_season_start_md_valid;
alter table heroes add constraint heroes_season_start_md_valid check (
  season_start_md is null
  or season_start_md ~ '^((01|03|05|07|08|10|12)-(0[1-9]|[12][0-9]|3[01])|(04|06|09|11)-(0[1-9]|[12][0-9]|30)|02-(0[1-9]|1[0-9]|2[0-8]))$');

alter table heroes drop constraint if exists heroes_season_pair;
alter table heroes add constraint heroes_season_pair check (
  (season is null) = (season_start_md is null));

-- Улирлын мөр арга хэмжээ, огноогүй — хугацааг нь `season_start_md` шийднэ.
alter table heroes drop constraint if exists heroes_season_solo;
alter table heroes add constraint heroes_season_solo check (
  season is null
  or (sale_event_id is null and starts_at is null and ends_at is null));

alter table heroes drop constraint if exists heroes_product_count;
alter table heroes add constraint heroes_product_count check (
  cardinality(product_ids) <= 3);

-- Өргөтгөл: улирлын мөр ч хугацаатай гэж тооцогдоно.
alter table heroes drop constraint if exists heroes_period;
alter table heroes add constraint heroes_period check (
  sale_event_id is not null
  or season is not null
  or (starts_at is not null and ends_at is not null and ends_at > starts_at));

create unique index if not exists heroes_season_uniq
  on heroes (season) where season is not null;

------------------------------------------------------------------------------
-- 2. `p_at` мөчийн улирлын баннер + тооцоолсон хугацаа.
------------------------------------------------------------------------------
-- Бэлэн (идэвхтэй, хоёр зурагтай) улирлын мөрүүдээс эхлэх өдөр нь `p_at`-ийн
-- УБ өдрөөс хойшгүй хамгийн сүүлийнх; жилийн эхэнд ийм нь байхгүй бол хамгийн
-- сүүлд эхэлдэг нь (өмнөх оноос үргэлжилнэ). `starts_at` = энэ улирлын эхлэл,
-- `ends_at` = дараагийн бэлэн улирлын эхлэл (УБ 00:00, exclusive) — дэлгүүрийн
-- `pickLiveHero` кэш улирал солигдох мөчид хуучныг гаргахгүй.
-- TS-ийн `seasonHeroAt()` (src/features/heroes/season.ts)-тай ИЖИЛ дүрэм.

create or replace function season_hero_at(p_at timestamptz)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day   date := (p_at at time zone 'Asia/Ulaanbaatar')::date;
  v_md    text := to_char(v_day, 'MM-DD');
  v_year  int  := extract(year from v_day)::int;
  v_id    uuid;
  v_cur   text;
  v_next  text;
  v_start_year int;
  v_end_year   int;
begin
  select h.id, h.season_start_md into v_id, v_cur
    from heroes h
   where h.season is not null and h.is_active
     and h.desktop_image is not null and h.mobile_image is not null
     and h.season_start_md <= v_md
   order by h.season_start_md desc, h.id
   limit 1;
  v_start_year := v_year;
  if v_id is null then
    select h.id, h.season_start_md into v_id, v_cur
      from heroes h
     where h.season is not null and h.is_active
       and h.desktop_image is not null and h.mobile_image is not null
     order by h.season_start_md desc, h.id
     limit 1;
    v_start_year := v_year - 1;
  end if;
  if v_id is null then
    return;
  end if;

  select h.season_start_md into v_next
    from heroes h
   where h.season is not null and h.is_active
     and h.desktop_image is not null and h.mobile_image is not null
     and h.season_start_md > v_cur
   order by h.season_start_md, h.id
   limit 1;
  v_end_year := v_start_year;
  if v_next is null then
    -- Жилийн эргэлт: хамгийн эрт эхэлдэг нь (ганц бол өөрөө) ирэх онд.
    select h.season_start_md into v_next
      from heroes h
     where h.season is not null and h.is_active
       and h.desktop_image is not null and h.mobile_image is not null
     order by h.season_start_md, h.id
     limit 1;
    v_end_year := v_start_year + 1;
  end if;

  return query select
    v_id,
    (to_date(v_start_year || '-' || v_cur, 'YYYY-MM-DD')::timestamp
       at time zone 'Asia/Ulaanbaatar'),
    (to_date(v_end_year || '-' || v_next, 'YYYY-MM-DD')::timestamp
       at time zone 'Asia/Ulaanbaatar');
end $$;

revoke all on function season_hero_at(timestamptz) from public;
grant execute on function season_hero_at(timestamptz) to service_role;

comment on function season_hero_at(timestamptz) is
  'Улирлын баннер (0185): p_at мөчид аль улирлын мөр, тооцоолсон эхлэл/төгсгөлтэй. '
  'TS seasonHeroAt()-тэй ижил дүрэм.';

------------------------------------------------------------------------------
-- 3. live_heroes() / live_hero() — улирлын шатыг ард нь нэмнэ.
------------------------------------------------------------------------------
-- Одоогийн шүүлтээр гарсан мөрүүд (арга хэмжээ, тусгай өдөр) эхэнд, өмнөх
-- эрэмбээр; ард нь одоогийн улирлын ганц мөр. Улирлын мөрийн товч ч бусдын
-- адил шалгагдана (эхлээгүй арга хэмжээ рүү заавал алгасна, F2).

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
  ),
  season_now as (
    select * from season_hero_at(now())
  ),
  candidates as (
    select h.*,
           0 as tier,
           coalesce(le.starts_at, h.starts_at) as eff_start,
           coalesce(le.ends_at, h.ends_at) as eff_end
      from heroes h
      left join live_events le on le.id = h.sale_event_id
     where h.season is null
       and h.is_active
       and h.desktop_image is not null
       and h.mobile_image is not null
       and case
             when h.sale_event_id is not null then le.id is not null
             else h.starts_at <= now() and now() < h.ends_at
           end
    union all
    select h.*, 1, s.starts_at, s.ends_at
      from heroes h
      join season_now s on s.id = h.id
  )
  select c.id, c.eyebrow, c.title, c.description, c.mobile_description,
         c.primary_label, c.primary_target, c.secondary_label,
         c.secondary_target, c.desktop_image, c.mobile_image, c.image_alt,
         c.dark, c.eff_start, c.eff_end
    from candidates c
   where feature_enabled('hero_admin')
     and (c.primary_target->>'type' <> 'event'
          or exists (select 1 from live_events x
                      where x.slug = c.primary_target->>'slug'))
     and (c.secondary_target is null
          or c.secondary_target->>'type' <> 'event'
          or exists (select 1 from live_events x
                      where x.slug = c.secondary_target->>'slug'))
   order by c.tier, c.priority desc, c.eff_start desc, c.id
   limit 5;
$$;

revoke all on function live_heroes() from public;
grant execute on function live_heroes() to anon, authenticated, service_role;

comment on function live_heroes() is
  'Дэлгүүрт одоо гарах ёстой hero-ууд эрэмбээр (0184, ихдээ 5); 0185-аас ард нь '
  'одоогийн улирлын баннер. Эхнийх = live_hero().';

create or replace function live_hero()
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
  select * from live_heroes() limit 1;
$$;

revoke all on function live_hero() from public;
grant execute on function live_hero() to anon, authenticated, service_role;

comment on column heroes.season is
  'Улирлын баннер (0185): spring|summer|autumn|winter, улирал бүрт нэг мөр.';
comment on column heroes.season_start_md is
  'Улирлын эхлэх өдөр MM-DD (УБ), жил бүр давтагдана.';
comment on column heroes.product_ids is
  'Баннерын зурган дээрх үнэртнүүд (ихдээ 3, зүүн→баруун) — «үнэртэн солих» (D10).';
