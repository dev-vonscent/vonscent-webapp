-- Кампанит ажил (ClickUp «Sign-up coupon campaign»). Эхний төрөл нь
-- `signup_coupon`: идэвхтэй кампанит ажлын хугацаанд шинээр бүртгүүлсэн
-- хэрэглэгч бүрт хувийн купон олгоно (5,000₮ гэх мэт, дүнг админ тохируулна).
--
-- Feature flag `campaigns` (0133) — анхдагч `false`, prod-д хаалттай.
--
-- Купон нь энгийн ХУВИЙН купон (`user_id` = эзэмшигч, `max_uses = 1`), тиймээс
-- ашиглах дүрэм бүгд хэвээр: бусдад кодоо өгч болно, ашиглагдмагц
-- эзэмшигчийнх `used_up` болно (0119), `place_order` купоны мөрийг
-- `for update`-аар түгжинэ (0104) — нэг код хоёр удаа ашиглагдахгүй.
--
-- Яагаад `auth.users` дээрх trigger биш вэ: тэр мөрийг бүртгэлээс гадна
-- `db-clone --full`, `seed-demo`, Supabase dashboard ч үүсгэдэг — clone хийсэн
-- бүх хэрэглэгчид купон тарааж болзошгүй. Тиймээс бүртгэлийн route
-- (`/api/auth/phone/register`) RPC-г шууд дуудна.

insert into feature_flags (key) values ('campaigns') on conflict do nothing;

-- ── 1. Кампанит ажил ───────────────────────────────────────────────────
-- Төрөл бүр өөрийн багануудыг ашиглана. Шинэ төрөл нэмэхэд check-ийг
-- өргөтгөж, хэрэгтэй бол nullable багана нэмнэ (expand only).
--
-- Хугацаа нь ӨДРӨӨР (UB): `starts_on`-ийн 00:00:00-оос `ends_on`-ийн
-- 23:59:59 хүртэл. timestamptz биш date — админ «хэдэн цагт» гэж бодохгүй,
-- хөтчийн цагийн бүс ч нөлөөлөхгүй.
create table if not exists campaigns (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('signup_coupon')),
  name              text not null check (length(btrim(name)) between 1 and 120),
  description       text not null default '',
  is_active         boolean not null default false,
  starts_on         date not null,
  ends_on           date not null,
  -- Купоны тохиргоо (₮, integer).
  coupon_value      int not null check (coupon_value > 0),
  min_subtotal      int not null default 0 check (min_subtotal >= 0),
  coupon_valid_days int not null check (coupon_valid_days between 1 and 365),
  coupons_per_user  int not null default 1 check (coupons_per_user between 1 and 10),
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint campaigns_dates check (ends_on >= starts_on)
);

create index if not exists campaigns_live_idx
  on campaigns (type, starts_on, ends_on) where is_active;

drop trigger if exists campaigns_updated_at on campaigns;
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- Ижил төрлийн хоёр ИДЭВХТЭЙ кампанит ажлын хугацаа давхцахгүй: эс бөгөөс
-- шинэ хэрэглэгч хоёуланг нь авах (5,000 + 10,000) эсвэл аль нь ялахыг хэн ч
-- мэдэхгүй болно. Exclusion constraint нь `btree_gist` шаарддаг тул trigger;
-- advisory lock нь хоёр админ зэрэг хадгалах үеийн race-ийг хаана.
create or replace function campaigns_no_overlap()
returns trigger language plpgsql as $$
declare
  v_other text;
begin
  if not new.is_active then return new; end if;
  perform pg_advisory_xact_lock(hashtext('campaigns:' || new.type));
  select name into v_other from campaigns
   where type = new.type and is_active and id <> new.id
     and starts_on <= new.ends_on and ends_on >= new.starts_on
   order by starts_on
   limit 1;
  if found then
    raise exception 'CAMPAIGN_OVERLAP:%', v_other using errcode = 'exclusion_violation';
  end if;
  return new;
end $$;

drop trigger if exists campaigns_no_overlap on campaigns;
create trigger campaigns_no_overlap
  before insert or update of is_active, type, starts_on, ends_on on campaigns
  for each row execute function campaigns_no_overlap();

-- ── 2. Олголтын бүртгэл ────────────────────────────────────────────────
-- Хэрэглэгч бүр кампанит ажил тус бүрээс нэг л удаа. Утсаар ч давхар
-- шалгана: бүртгэлээ устгаад ижил дугаараар дахин бүртгүүлбэл дахин авахгүй
-- (тиймээс `user_id` нь устгалтад null болно, мөр нь үлдэнэ).
create table if not exists campaign_grants (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  user_id     uuid references auth.users(id) on delete set null,
  phone       text,
  -- Хэрэглэгчид мэдэгдэл (popup) харуулсан үе; null = хараахан хараагүй.
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create unique index if not exists campaign_grants_phone_key
  on campaign_grants (campaign_id, phone) where phone is not null;
create index if not exists campaign_grants_unseen_idx
  on campaign_grants (user_id) where notified_at is null;

-- Купон аль кампанит ажлаас гарсныг — админы тоолол (олгосон / ашигласан).
alter table coupons
  add column if not exists campaign_id uuid references campaigns(id) on delete set null;
create index if not exists coupons_campaign_idx
  on coupons (campaign_id) where campaign_id is not null;

-- ── 3. RLS ─────────────────────────────────────────────────────────────
-- Уншилт зөвхөн staff. Бичилт policy-гүй: админы route ба RPC service-role-оор.
-- Хэрэглэгчийн popup `/api/campaigns/welcome` (service-role) -аар уншина.
alter table campaigns enable row level security;
drop policy if exists "campaigns staff read" on campaigns;
create policy "campaigns staff read" on campaigns
  for select using (is_staff());

alter table campaign_grants enable row level security;
drop policy if exists "campaign grants staff read" on campaign_grants;
create policy "campaign grants staff read" on campaign_grants
  for select using (is_staff());

-- ── 4. Бүртгэлийн купон олгох ──────────────────────────────────────────
-- Буцаах: олгосон бол { campaignId, count, value }, эс бөгөөс null.
-- Купон хүчинтэй хугацаа: олгосон өдрөөс +N дэх өдрийн 23:59:59 (UB).
create or replace function grant_signup_coupons(p_user uuid, p_phone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  c campaigns%rowtype;
  v_grant uuid;
  v_ends timestamptz;
  i int;
begin
  -- Туг хаалттай үед юу ч үүсэхгүй (CLAUDE.md, 0130-ийн сургамж).
  if not feature_enabled('campaigns') then return null; end if;
  if p_user is null then return null; end if;

  -- Давхцал trigger-ээр хаалттай тул ихэнхдээ ганц мөр; хуучин өгөгдөлд
  -- хамгаалалт болгож хамгийн сүүлд эхэлснийг сонгоно.
  select * into c from campaigns
   where type = 'signup_coupon' and is_active
     and v_today between starts_on and ends_on
   order by starts_on desc, created_at desc
   limit 1;
  if not found then return null; end if;

  -- Нэг хэрэглэгч / нэг утас — нэг удаа. Unique хязгаарлалт зэрэг дуудлагыг
  -- ч барина: хоёр дахь нь мөр оруулж чадахгүй, купон үүсгэхгүй.
  insert into campaign_grants (campaign_id, user_id, phone)
  values (c.id, p_user, nullif(btrim(coalesce(p_phone, '')), ''))
  on conflict do nothing
  returning id into v_grant;
  if v_grant is null then return null; end if;

  v_ends := ((v_today + c.coupon_valid_days + 1)::timestamp
              at time zone 'Asia/Ulaanbaatar') - interval '1 second';

  for i in 1..c.coupons_per_user loop
    insert into coupons (code, user_id, type, value, min_subtotal,
                         max_uses, max_uses_per_user, ends_at, is_active,
                         source, campaign_id)
    values (generate_coupon_code('VN'), p_user, 'fixed', c.coupon_value,
            c.min_subtotal, 1, 1, v_ends, true, 'campaign', c.id);
  end loop;

  return jsonb_build_object('campaignId', c.id,
    'count', c.coupons_per_user, 'value', c.coupon_value);
end $$;

revoke all on function grant_signup_coupons(uuid, text) from public, anon, authenticated;
do $$ begin
  grant execute on function grant_signup_coupons(uuid, text) to service_role;
exception when undefined_object then null; end $$;

comment on table campaigns is
  'Кампанит ажил (0135). signup_coupon: бүртгүүлэхэд хувийн купон. '
  'Feature flag `campaigns` хаалттай үед grant_signup_coupons юу ч үүсгэхгүй.';
