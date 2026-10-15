-- Feature flag — шинэ feature-ийг prod руу УНТРААЛТТАЙ оруулж, release өдөр
-- админаас нээх (CLAUDE.md «Шинэ feature → prod»).
--
-- Яагаад `constants.ts`-ийн `*_HIDDEN` биш вэ: тэр нь кодонд бичигддэг тул dev
-- ба main ХОЁУЛАА нэг утгатай. Клиентэд dev дээр харуулахын тулд `false`
-- болгоход release-ийн өмнө гараар буцааж `true` болгохоо санах ёстой болсон
-- (LUCKY_WHEEL_HIDDEN, RELEASE_CHECKLIST §0). Энд туг нь САНД байх тул dev ба
-- prod сан тус тусдаа утгатай, асаахад deploy хэрэггүй.
--
-- Яагаад `settings` (key/jsonb) биш вэ: `settings` нь anon-д уншигдах
-- (0009) — нээгдээгүй feature-ийн нэр олон нийтэд ил болно; мөн туг бүрт
-- хэн/хэзээ асаасныг (`updated_by`) тусад нь хадгалах хэрэгтэй.
--
-- Мөр нь feature-ийн ӨӨРИЙН migration-д нэмэгдэнэ (анхдагч `false`):
--   insert into feature_flags (key) values ('tier_list') on conflict do nothing;

create table if not exists feature_flags (
  key        text        primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  enabled    boolean     not null default false,
  updated_by uuid        references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists feature_flags_updated_at on feature_flags;
create trigger feature_flags_updated_at
  before update on feature_flags
  for each row execute function set_updated_at();

alter table feature_flags enable row level security;

-- Уншилт зөвхөн staff (админы хуудас). Дэлгүүр нь серверээс service-role-оор
-- уншиж, ЗӨВХӨН асаалттай тугуудыг client руу дамжуулна.
-- Бичих policy байхгүй: зөвхөн `/api/admin/feature-flags` (super_admin,
-- service-role) бичнэ.
drop policy if exists "feature flags read" on feature_flags;
create policy "feature flags read" on feature_flags
  for select using (is_staff());

comment on table feature_flags is
  'Feature flag: enabled = false бол feature UI, API, trigger/cron гурван '
  'давхаргад бүгд унтраалттай. Сан тус бүрт (dev/prod) тусдаа утгатай.';

-- Trigger, RPC, pg_cron дотроос шалгах НЭГ газар. Мөр байхгүй = унтраалттай
-- (fail closed): migration ажилласан ч мөр нэмэгдээгүй бол юу ч нээгдэхгүй.
--
-- `security definer` — trigger нь anon/customer эрхээр ажиллахад staff-only
-- RLS-д бүдрэхгүй. Буцаах зүйл нь ганц boolean тул ил болох мэдээлэл бага.
create or replace function feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled from feature_flags where key = p_key),
    false
  );
$$;

comment on function feature_enabled(text) is
  'Туг асаалттай эсэх; мөр байхгүй бол false. Trigger/RPC/cron-д: '
  'if not feature_enabled(''tier_list'') then return new; end if;';
