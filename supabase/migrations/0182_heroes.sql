-- Админаас удирддаг нүүрний hero (docs/campaigns/plan.md §4.5, §7, §9.2).
-- Feature flag `hero_admin` — `sale_events`-ээс бие даан нээгдэнэ.
--
-- Өмнө нь hero кодод (`HOME_CAMPAIGNS`, home-content.ts) байсан тул текст,
-- холбоос, зураг солих бүрт хөгжүүлэгч + deploy хэрэгтэй байв. Одоо админ
-- бичиж, хуваарь тавина. Кодын `HOME_CAMPAIGNS` / `EVERGREEN_HERO` нь НӨӨЦ
-- болж үлдэнэ (DB хоосон / алдаа / demo / туг хаалттай).
--
-- Арга хэмжээтэй (0181) холбож болно: тэгвэл hero-гийн хугацаа арга
-- хэмжээнийхээс уншигдаж, арга хэмжээ цуцлагдвал hero ч унтарна — hero ба
-- үнэ НЭГ `sale_events.starts_at/ends_at`-аас (plan §10).
--
-- Хүснэгт staff-only RLS: нийтлээгүй/товлосон hero-гийн текст урьдчилж
-- уншигдахгүй. Дэлгүүр зөвхөн `live_hero()` (security definer).
--
-- Туг хаалттай үед: `live_hero()` хоосон, бичилт `FEATURE_DISABLED`
-- (trigger) — prod дээр юу ч хуримтлагдахгүй.
--
-- Expand only: шинэ хүснэгт, шинэ функц.

insert into feature_flags (key) values ('hero_admin') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Хүснэгт.
------------------------------------------------------------------------------

-- Товчны холбоос (plan §7.3):
--   {"type":"event","slug":"black-friday"}   → /sale/black-friday
--   {"type":"season","value":"winter"}        → /catalog?kind=perfume&season=winter
--   {"type":"catalog","query":"tags=new"}     → /catalog?tags=new
--   {"type":"path","href":"/collections/build"} — зөвхөн дотоод хаяг
create or replace function hero_target_valid(t jsonb)
returns boolean language sql immutable as $$
  select t is not null
     and jsonb_typeof(t) = 'object'
     and case t->>'type'
           when 'event'   then coalesce(t->>'slug', '') ~ '^[a-z0-9-]{2,60}$'
           when 'season'  then coalesce(t->>'value', '') in
                                 ('spring', 'summer', 'autumn', 'winter')
           when 'catalog' then length(coalesce(t->>'query', '')) <= 300
           -- `/`-ээр эхэлсэн, `//` (protocol-relative) ба `\` биш — гадагш
           -- redirect, phishing-ээс сэргийлнэ.
           when 'path'    then coalesce(t->>'href', '') ~ '^/(?![/\\])\S*$'
                               and length(t->>'href') <= 300
           else false
         end;
$$;

create table if not exists heroes (
  id               uuid primary key default gen_random_uuid(),
  -- Дотоод нэр (админы жагсаалт).
  name             text not null check (length(btrim(name)) between 1 and 60),
  sale_event_id    uuid references sale_events(id) on delete set null,
  starts_at        timestamptz,
  ends_at          timestamptz,
  priority         int not null default 0 check (priority between -100 and 100),
  is_active        boolean not null default false,
  eyebrow          text not null default '' check (length(eyebrow) <= 40),
  title            text not null check (length(btrim(title)) between 1 and 48),
  description      text not null default '' check (length(description) <= 140),
  mobile_description text check (mobile_description is null
                                 or length(mobile_description) <= 70),
  primary_label    text not null check (length(btrim(primary_label)) between 1 and 22),
  primary_target   jsonb not null check (hero_target_valid(primary_target)),
  secondary_label  text check (secondary_label is null
                               or length(btrim(secondary_label)) between 1 and 22),
  secondary_target jsonb check (secondary_target is null
                                or hero_target_valid(secondary_target)),
  -- {base, widths:[1600,2400,3200], height1600} — storage URL-ууд.
  desktop_image    jsonb,
  -- {src, width, height}
  mobile_image     jsonb,
  image_alt        text not null default '' check (length(image_alt) <= 200),
  -- Бараан хана → цагаан текст.
  dark             boolean not null default false,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Хоёр товч хоёулаа эсвэл аль нь ч биш.
  constraint heroes_secondary_pair check (
    (secondary_label is null) = (secondary_target is null)),
  -- Холбоогүй hero өөрийн хугацаатай байх ёстой.
  constraint heroes_period check (
    sale_event_id is not null
    or (starts_at is not null and ends_at is not null and ends_at > starts_at)),
  -- Зураггүй hero идэвхтэй болж чадахгүй (plan §7.2).
  constraint heroes_active_images check (
    not is_active or (desktop_image is not null and mobile_image is not null))
);

create index if not exists heroes_live_idx
  on heroes (priority desc, starts_at desc) where is_active;

drop trigger if exists heroes_updated_at on heroes;
create trigger heroes_updated_at
  before update on heroes
  for each row execute function set_updated_at();

-- Туг хаалттай үед бичилт хориотой — prod дээр өгөгдөл хуримтлагдахгүй
-- (CLAUDE.md, 0130-ийн сургамж). Route ч 404 буцаадаг; энэ нь гурав дахь давхарга.
create or replace function heroes_feature_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Арга хэмжээ устахад (доорх trigger) системийн шинэчлэл — тугаас үл хамаарна.
  if current_setting('vonscent.hero_sync', true) = 'on' then
    return new;
  end if;
  if not feature_enabled('hero_admin') then
    raise exception 'FEATURE_DISABLED';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists heroes_feature_guard on heroes;
create trigger heroes_feature_guard
  before insert or update on heroes
  for each row execute function heroes_feature_guard();

-- Холбоотой арга хэмжээ устахад (зөвхөн ноорог устгагддаг, 0181) FK нь
-- `set null` хийнэ — тэгвэл hero хугацаагүй үлдэж `heroes_period`-ийг
-- зөрчих байв. Устахаас өмнө hero-д арга хэмжээний хугацааг хуулж, ноорог
-- болгоно: админы бичсэн текст, зураг алдагдахгүй, санамсаргүй гарахгүй.
create or replace function sale_events_detach_heroes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('vonscent.hero_sync', 'on', true);
  update heroes
     set starts_at = old.starts_at,
         ends_at = old.ends_at,
         is_active = false
   where sale_event_id = old.id;
  perform set_config('vonscent.hero_sync', 'off', true);
  return old;
end $$;

drop trigger if exists sale_events_detach_heroes on sale_events;
create trigger sale_events_detach_heroes
  before delete on sale_events
  for each row execute function sale_events_detach_heroes();

------------------------------------------------------------------------------
-- 2. RLS — зөвхөн staff уншина; бичилт service-role (route handler).
------------------------------------------------------------------------------

alter table heroes enable row level security;
drop policy if exists "heroes staff read" on heroes;
create policy "heroes staff read" on heroes
  for select using (is_staff());

------------------------------------------------------------------------------
-- 3. Одоо гарах ёстой нэг hero (plan §7.1–§7.2).
--
--   · идэвхтэй, хоёр зурагтай;
--   · холбоотой бол арга хэмжээ нийтлэгдсэн ба LIVE; эс бөгөөс өөрийн хугацаа;
--   · товч нь арга хэмжээ рүү заадаг бол тэр арга хэмжээ LIVE (эвдэрсэн
--     товчтой hero гарахгүй);
--   · priority их нь, дараа нь хамгийн сүүлд эхэлсэн нь.
-- Хоосон бол дэлгүүр кодын hero-г (HOME_CAMPAIGNS → EVERGREEN) харуулна.
------------------------------------------------------------------------------

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
   limit 1;
$$;

revoke all on function live_hero() from public;
grant execute on function live_hero() to anon, authenticated, service_role;

comment on table heroes is
  'Нүүрний hero (0182): админ бичнэ, хуваарьтай, арга хэмжээтэй холбогдож '
  'болно. Дэлгүүр live_hero()-оор уншина; хоосон бол кодын hero. Туг hero_admin.';
