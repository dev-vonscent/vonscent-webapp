-- Хэрэглэгчийн мэдэгдэл (docs/planning/notifications-plan.md).
--
-- Header-ийн хонх + toast. Хоёр эх үүсвэр нэг хүснэгтэд (`user_notifications`):
--   • Нийтийн (broadcast) — админ бичнэ, илгээх үед хэрэглэгч бүрт нэг мөр
--     (fan-out, нэг `insert … select`). Илгээсний дараа бүртгүүлсэн хэрэглэгч
--     хуучин зарыг харахгүй (клиент баталсан, 2026-10-18).
--   • Хувийн (personal) — систем `notify_user()`-оор (0139–0141 producer-ууд).
--
-- `admin_notifications` (0032, staff-ийн дотоод мэдэгдэл) хөндөгдөхгүй.
--
-- Feature flag `notifications` (0133) — анхдагч `false`, prod-д хаалттай.
-- Бичих цорын ганц зам нь доорх RPC-ууд (service_role): туг хаалттай үед
-- `notify_user` юу ч үүсгэхгүй, `send_broadcast` алдаа өгнө, cron алгасна —
-- prod дээр нэг ч мөр хуримтлагдахгүй (0130-ийн сургамж).

insert into feature_flags (key) values ('notifications') on conflict do nothing;

-- ── 1. Төрөл ───────────────────────────────────────────────────────────
-- Шинэ төрлийг `alter type … add value`-ээр (expand-only).
do $$ begin
  create type notification_kind_t as enum (
    -- broadcast
    'product_new', 'promotion', 'campaign', 'feature', 'announcement',
    -- personal
    'points_released', 'free_spin_ready',
    'order_paid', 'order_shipping', 'order_delivered',
    'order_cancelled', 'order_refunded', 'order_saved'
  );
exception when duplicate_object then null; end $$;

-- ── 2. Хүснэгтүүд ──────────────────────────────────────────────────────
-- Админы бичсэн нийтийн мэдэгдэл (эх загвар + статистик). Хэзээ ч устгахгүй —
-- буцааж татсан ч `cancelled` төлөвтэй үлдэнэ (audit).
create table if not exists notification_broadcasts (
  id              uuid primary key default gen_random_uuid(),
  kind            notification_kind_t not null,
  title           text not null check (char_length(title) between 1 and 80),
  body            text check (char_length(body) <= 300),
  url             text check (url is null or char_length(url) <= 500),
  image_path      text,
  audience        text not null default 'all' check (audience in ('all')), -- phase 2: сегмент
  publish_at      timestamptz not null default now(),
  status          text not null default 'draft'
                  check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  sent_at         timestamptz,
  recipient_count int,
  cancelled_at    timestamptz,
  cancelled_by    uuid references profiles(id),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists notification_broadcasts_updated_at on notification_broadcasts;
create trigger notification_broadcasts_updated_at
  before update on notification_broadcasts
  for each row execute function set_updated_at();

create index if not exists notification_broadcasts_list_idx
  on notification_broadcasts (created_at desc);
create index if not exists notification_broadcasts_due_idx
  on notification_broadcasts (publish_at) where status = 'scheduled';

-- Хэрэглэгч бүрийн мэдэгдэл (хувийн + fan-out хийсэн broadcast).
create table if not exists user_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         notification_kind_t not null,
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (char_length(body) <= 400),
  url          text check (url is null or char_length(url) <= 500),
  image_path   text,
  data         jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  broadcast_id uuid references notification_broadcasts(id) on delete cascade,
  dedupe_key   text check (char_length(dedupe_key) <= 120),
  -- Ирээдүйд бол тэр цагт л харагдана (ж: өдрийн үнэгүй эрх сэргэх, 0140).
  visible_at   timestamptz not null default now(),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  -- Broadcast мөр broadcast_id-аар, хувийн мөр dedupe_key-ээр давхардлаас
  -- хамгаалагдана (null нь unique index-д тоологддоггүй).
  constraint user_notifications_source_chk check (
    (broadcast_id is not null and dedupe_key is null)
    or (broadcast_id is null and nullif(dedupe_key, '') is not null)
  )
);

create unique index if not exists user_notifications_dedupe_uidx
  on user_notifications (user_id, dedupe_key) where dedupe_key is not null;
create unique index if not exists user_notifications_broadcast_uidx
  on user_notifications (user_id, broadcast_id) where broadcast_id is not null;
create index if not exists user_notifications_feed_idx
  on user_notifications (user_id, visible_at desc, id desc);
create index if not exists user_notifications_unread_idx
  on user_notifications (user_id, visible_at) where read_at is null;
-- Broadcast-ын уншсан тоо (админы жагсаалт) ба буцааж татах.
create index if not exists user_notifications_broadcast_idx
  on user_notifications (broadcast_id) where broadcast_id is not null;

-- ── 3. RLS / эрх ───────────────────────────────────────────────────────
-- Хэрэглэгчид ЗӨВХӨН SELECT. UPDATE policy өгөхгүй: RLS багана биш мөр
-- хамгаалдаг тул update эрх өгвөл хэрэглэгч гарчиг/URL-аа өөрчилж чадна.
-- Уншсан болгох нь `mark_notifications_read` (service_role)-оор.
alter table user_notifications enable row level security;
drop policy if exists "user notifications own read" on user_notifications;
create policy "user notifications own read" on user_notifications
  for select using (user_id = auth.uid());
revoke insert, update, delete on user_notifications from anon, authenticated;

alter table notification_broadcasts enable row level security;
drop policy if exists "notification broadcasts staff read" on notification_broadcasts;
create policy "notification broadcasts staff read" on notification_broadcasts
  for select using (is_staff());
revoke insert, update, delete on notification_broadcasts from anon, authenticated;

-- ── 4. RPC ─────────────────────────────────────────────────────────────
-- Хувийн мэдэгдэл үүсгэх НЭГ цэг — бүх producer (trigger/RPC/cron) үүнийг
-- дуудна. Туг хаалттай бол юу ч бичихгүй (null). Давхардвал (user, dedupe)
-- `on conflict do nothing` — null буцаана.
create or replace function notify_user(
  p_user       uuid,
  p_kind       notification_kind_t,
  p_title      text,
  p_body       text default null,
  p_url        text default null,
  p_data       jsonb default '{}',
  p_dedupe     text default null,
  p_visible_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not feature_enabled('notifications') then return null; end if;
  if p_user is null then return null; end if;

  insert into user_notifications
    (user_id, kind, title, body, url, data, dedupe_key, visible_at)
  values (
    p_user, p_kind, left(p_title, 120), left(p_body, 400), p_url,
    coalesce(p_data, '{}'), p_dedupe, coalesce(p_visible_at, now())
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Broadcast-ыг бүх профайл руу (staff-ийг оруулаад, #5a) fan-out хийнэ.
-- Row lock + `(user_id, broadcast_id)` unique → давхар илгээгдэхгүй.
-- `recipient_count` нь ROW_COUNT — урьдчилсан count(*) биш, зэрэг
-- бүртгүүлэлтээс зөрөхгүй.
create or replace function send_broadcast(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_b notification_broadcasts%rowtype;
  v_n int;
begin
  if not feature_enabled('notifications') then
    raise exception 'notifications feature disabled' using errcode = 'P0001';
  end if;

  select * into v_b from notification_broadcasts where id = p_id for update;
  if not found then
    raise exception 'broadcast not found' using errcode = 'P0002';
  end if;
  if v_b.status not in ('draft', 'scheduled') then
    raise exception 'broadcast already %', v_b.status using errcode = 'P0001';
  end if;

  insert into user_notifications
    (user_id, kind, title, body, url, image_path, broadcast_id, data)
  select p.id, v_b.kind, v_b.title, v_b.body, v_b.url, v_b.image_path, v_b.id,
         jsonb_build_object('broadcastId', v_b.id)
    from profiles p
  on conflict (user_id, broadcast_id) where broadcast_id is not null do nothing;
  get diagnostics v_n = row_count;

  update notification_broadcasts
     set status = 'sent', sent_at = now(), recipient_count = v_n
   where id = p_id;
  return v_n;
end $$;

-- Буцааж татах: хэрэглэгчийн мөрүүдийг устгана, broadcast мөр audit-д
-- `cancelled` төлөвтэй үлдэнэ. Хуваарьт (илгээгдээгүй) ч цуцалж болно.
-- Туг шалгахгүй — хаалттай үед ч устгах нь аюулгүй.
create or replace function cancel_broadcast(p_id uuid, p_by uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_n int;
begin
  select status into v_status from notification_broadcasts where id = p_id for update;
  if not found then
    raise exception 'broadcast not found' using errcode = 'P0002';
  end if;
  if v_status = 'cancelled' then
    return 0;
  end if;

  delete from user_notifications where broadcast_id = p_id;
  get diagnostics v_n = row_count;

  update notification_broadcasts
     set status = 'cancelled', cancelled_at = now(), cancelled_by = p_by
   where id = p_id;
  return v_n;
end $$;

-- Уншсан болгох. `p_ids` null = бүгдийг. Зөвхөн харагдаж буй
-- (`visible_at <= now()`) мөр. `p_user`-ийг route handler SESSION-оос авна,
-- request body-оос хэзээ ч биш.
create or replace function mark_notifications_read(p_user uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  update user_notifications
     set read_at = now()
   where user_id = p_user
     and read_at is null
     and visible_at <= now()
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 5. pg_cron ─────────────────────────────────────────────────────────
-- Хуваарьт broadcast. Туг удаан хаалттай байгаад нээгдвэл `publish_at`-аас
-- 24 цагаас хэтэрсэнийг ИЛГЭЭХГҮЙ — `scheduled` хэвээр үлдэж админы
-- жагсаалтад «Хугацаа хэтэрсэн» гэж харагдана (хуучирсан хямдрал
-- санамсаргүй явахаас сэргийлнэ). Нэг эвдэрсэн нь бусдыг блоклохгүй.
create or replace function send_scheduled_broadcasts()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  n int := 0;
begin
  if not feature_enabled('notifications') then return 0; end if;

  for v_id in
    select id from notification_broadcasts
     where status = 'scheduled'
       and publish_at <= now()
       and publish_at > now() - interval '24 hours'
     order by publish_at
     for update skip locked
  loop
    begin
      perform send_broadcast(v_id);
      n := n + 1;
    exception when others then
      raise warning 'send_scheduled_broadcasts %: %', v_id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

-- Хадгалах хугацаа (клиент баталсан): уншсан → 90 хоног, бүгд → 180 хоног.
-- `visible_at`-аар — ирээдүйд харагдах мөрийг устгахгүй.
create or replace function prune_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  delete from user_notifications
   where read_at < now() - interval '90 days'
      or visible_at < now() - interval '180 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

do $$
begin
  perform cron.unschedule('send-scheduled-broadcasts');
exception when others then null; end $$;
do $$
begin
  perform cron.unschedule('prune-notifications');
exception when others then null; end $$;

select cron.schedule('send-scheduled-broadcasts', '*/5 * * * *', $$select send_scheduled_broadcasts();$$);
select cron.schedule('prune-notifications', '30 4 * * *', $$select prune_notifications();$$);

-- ── 6. Function эрх ────────────────────────────────────────────────────
revoke all on function notify_user(uuid, notification_kind_t, text, text, text, jsonb, text, timestamptz)
  from public, anon, authenticated;
revoke all on function send_broadcast(uuid) from public, anon, authenticated;
revoke all on function cancel_broadcast(uuid, uuid) from public, anon, authenticated;
revoke all on function mark_notifications_read(uuid, uuid[]) from public, anon, authenticated;
revoke all on function send_scheduled_broadcasts() from public, anon, authenticated;
revoke all on function prune_notifications() from public, anon, authenticated;
do $$ begin
  grant execute on function notify_user(uuid, notification_kind_t, text, text, text, jsonb, text, timestamptz) to service_role;
  grant execute on function send_broadcast(uuid) to service_role;
  grant execute on function cancel_broadcast(uuid, uuid) to service_role;
  grant execute on function mark_notifications_read(uuid, uuid[]) to service_role;
  grant execute on function send_scheduled_broadcasts() to service_role;
  grant execute on function prune_notifications() to service_role;
exception when undefined_object then null; end $$;

comment on table user_notifications is
  'Хэрэглэгчийн мэдэгдэл (0138): хувийн (dedupe_key) + fan-out broadcast (broadcast_id). '
  'Feature flag `notifications` хаалттай үед notify_user/send_broadcast юу ч үүсгэхгүй.';
comment on table notification_broadcasts is
  'Админы нийтийн мэдэгдэл (0138). Устгахгүй — cancelled төлөвтэй үлдэнэ.';
