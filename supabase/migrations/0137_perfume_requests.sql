-- Шинэ үнэртний санал (docs/planning/perfume-requests-plan.md).
--
-- Хэрэглэгч манайд байхгүй үнэртнийг санал болгоно; админ эрэлтийг тоогоор
-- харж худалдан авалтаа шийднэ. Нэг үнэртэн = НЭГ мөр (`match_key`) — ижил
-- үнэртнийг өөр хүн санал болгоход шинэ мөр биш «+1» санал болно.
--
-- Хамрах хүрээ (клиент, 2026-10-15): хэрэглэгч ЗӨВХӨН санал илгээнэ
-- (нэвтэрсэн байх). Хэрэглэгчийн «Миний саналууд», имэйл, админы
-- мэдэгдэл, төлөвийн удирдлага байхгүй — админ жагсаалтаас л харна.
--
-- Feature flag `perfume_requests` (0133) — анхдагч `false`, prod-д хаалттай.
-- Бичих цорын ганц зам нь доорх RPC-ууд (service_role) бөгөөд туг хаалттай
-- үед юу ч үүсгэхгүй.

insert into feature_flags (key) values ('perfume_requests') on conflict do nothing;

-- ── 1. Давхардлын түлхүүр ──────────────────────────────────────────────
-- Брэнд + нэрийг `search_normalize()` (0057)-оор хэвийн болгож (жижиг үсэг,
-- өргөлтгүй, кирилл→латин), зай ба цэг таслалыг хасна: «Dior Sauvage»,
-- «dior  sauvage», «Диор Sauvage» … нэг түлхүүрт буух хандлагатай. Барьж
-- чадаагүйг админ «Нэгтгэх»-ээр нийлүүлнэ.
create or replace function perfume_request_key(p_brand text, p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    search_normalize(coalesce(p_brand, '') || ' ' || coalesce(p_name, '')),
    '[[:space:][:punct:]]+', '', 'g'
  );
$$;

-- ── 2. Хүснэгтүүд ──────────────────────────────────────────────────────
create table if not exists perfume_requests (
  id            uuid primary key default gen_random_uuid(),
  -- Брэнд жагсаалтаас сонгосон бол; чөлөөт бичсэн бол null.
  brand_id      uuid references brands(id) on delete set null,
  brand_name    text not null check (length(btrim(brand_name)) between 1 and 80),
  perfume_name  text not null check (length(btrim(perfume_name)) between 1 and 120),
  -- `concentrations.code` (0085) — FK-гүй: админ төрлөө устгасан ч санал
  -- үлдэнэ. Route нь идэвхтэй жагсаалтаар шалгана. null = хэрэглэгч мэдэхгүй.
  concentration text check (concentration is null or length(concentration) <= 40),
  match_key     text not null unique check (match_key <> ''),
  -- `perfume_request_votes`-оос trigger-ээр тоологдоно.
  vote_count    int not null default 0 check (vote_count >= 0),
  last_voted_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists perfume_requests_queue_idx
  on perfume_requests (vote_count desc, last_voted_at desc);

-- Нэг хэрэглэгч × нэг үнэртэн = нэг санал.
create table if not exists perfume_request_votes (
  request_id uuid not null references perfume_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  note       text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists perfume_request_votes_user_idx
  on perfume_request_votes (user_id);

-- ── 3. Саналын тоо ─────────────────────────────────────────────────────
-- Дахин тоолох биш нэмэх/хасах: зэрэг ирсэн хоёр санал мөрийн түгжээгээр
-- дараалж, аль аль нь тоологдоно (`count(*)` дэд асуулга нь statement-ийн
-- snapshot-оор уншдаг тул нэгийгээ алдаж болзошгүй).
create or replace function perfume_request_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update perfume_requests
       set vote_count = greatest(vote_count - 1, 0)
     where id = old.request_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update perfume_requests
       set vote_count = vote_count + 1,
           last_voted_at = greatest(last_voted_at, new.created_at)
     where id = new.request_id;
  end if;
  return null;
end;
$$;

drop trigger if exists perfume_request_votes_count on perfume_request_votes;
create trigger perfume_request_votes_count
  after insert or delete or update of request_id on perfume_request_votes
  for each row execute function perfume_request_votes_count();

-- ── 4. RLS ─────────────────────────────────────────────────────────────
-- Уншилт зөвхөн staff. Бичих policy байхгүй: RPC ба админы route
-- service-role-оор.
alter table perfume_requests enable row level security;
drop policy if exists "perfume requests staff read" on perfume_requests;
create policy "perfume requests staff read" on perfume_requests
  for select using (is_staff());

alter table perfume_request_votes enable row level security;
drop policy if exists "perfume request votes staff read" on perfume_request_votes;
create policy "perfume request votes staff read" on perfume_request_votes
  for select using (is_staff());

-- ── 5. Санал илгээх ────────────────────────────────────────────────────
-- Буцаах: { requestId, isNew, isNewVote, voteCount } эсвэл туг хаалттай /
-- хэрэглэгчгүй үед null. Ижил хэрэглэгч дахин илгээвэл тоо нэмэгдэхгүй,
-- зөвхөн тайлбар нь шинэчлэгдэнэ.
create or replace function submit_perfume_request(
  p_user          uuid,
  p_brand         text,
  p_name          text,
  p_concentration text default null,
  p_note          text default null,
  p_brand_id      uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand    text := btrim(regexp_replace(coalesce(p_brand, ''), '\s+', ' ', 'g'));
  v_name     text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_brand_id uuid;
  v_key      text;
  v_id       uuid;
  v_new      boolean := false;
  v_new_vote boolean;
  v_count    int;
  v_try      int := 0;
begin
  -- Туг хаалттай үед юу ч үүсэхгүй (CLAUDE.md, 0130-ийн сургамж).
  if not feature_enabled('perfume_requests') then return null; end if;
  if p_user is null then return null; end if;

  v_key := perfume_request_key(v_brand, v_name);
  if v_brand = '' or v_name = '' or v_key = '' then
    raise exception 'INVALID_INPUT' using errcode = 'check_violation';
  end if;

  -- Устсан брэндийн id ирвэл FK алдаа биш, чөлөөт бичсэн мэт null болно.
  if p_brand_id is not null then
    select id into v_brand_id from brands where id = p_brand_id;
  end if;

  -- Байгаа мөрийг `for key share`-ээр түгжинэ: зэрэг явж буй нэгтгэл мөрийг
  -- устгавал саналыг FK алдаагаар унагахгүй — мөр уншихын өмнөхөн устсан
  -- бол дахин оролдоно (insert амжина). `for share` биш: зэрэг ирсэн хоёр
  -- санал хоёулаа vote_count-ыг шинэчлэх (no key update) гэж бие биеэ
  -- хүлээж deadlock болно; key share нь түүнтэй зөрчилддөггүй.
  loop
    v_try := v_try + 1;
    insert into perfume_requests (brand_id, brand_name, perfume_name,
                                  concentration, match_key)
    values (v_brand_id, v_brand, v_name, p_concentration, v_key)
    on conflict (match_key) do nothing
    returning id into v_id;

    if v_id is not null then
      v_new := true;
      exit;
    end if;

    select id into v_id from perfume_requests
     where match_key = v_key
     for key share;
    exit when found or v_try >= 3;
  end loop;
  if v_id is null then
    raise exception 'RETRY' using errcode = 'serialization_failure';
  end if;

  -- Анхны санал чөлөөт бичсэн байсан бол брэндийг холбоно.
  if not v_new and v_brand_id is not null then
    update perfume_requests set brand_id = v_brand_id
     where id = v_id and brand_id is null;
  end if;

  insert into perfume_request_votes (request_id, user_id, note)
  values (v_id, p_user, v_note)
  on conflict (request_id, user_id) do nothing;
  v_new_vote := found;

  if not v_new_vote and v_note is not null then
    update perfume_request_votes set note = v_note
     where request_id = v_id and user_id = p_user;
  end if;

  select vote_count into v_count from perfume_requests where id = v_id;

  return jsonb_build_object(
    'requestId', v_id,
    'isNew', v_new,
    'isNewVote', v_new_vote,
    'voteCount', v_count
  );
end;
$$;

-- ── 6. Нэгтгэх (админ) ─────────────────────────────────────────────────
-- `p_source`-ийн саналуудыг `p_target` руу шилжүүлж, `p_source`-ийг устгана.
-- Хоёуланд нь санал өгсөн хэрэглэгчийн давхар санал хасагдана.
create or replace function merge_perfume_requests(p_source uuid, p_target uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_source is null or p_target is null or p_source = p_target then
    raise exception 'INVALID_MERGE' using errcode = 'check_violation';
  end if;

  perform 1 from perfume_requests
   where id in (p_source, p_target)
   order by id
   for update;
  if (select count(*) from perfume_requests where id in (p_source, p_target)) <> 2 then
    raise exception 'NOT_FOUND' using errcode = 'no_data_found';
  end if;

  update perfume_request_votes
     set request_id = p_target
   where request_id = p_source
     and user_id not in (
       select user_id from perfume_request_votes where request_id = p_target
     );
  -- Үлдсэн нь давхар санал. Мөрийг устгахаас ӨМНӨ — cascade-ийн trigger
  -- устаж буй мөрийг шинэчлэх гэж оролдохгүй.
  delete from perfume_request_votes where request_id = p_source;

  delete from perfume_requests where id = p_source;

  -- Trigger-ийн нэмэх/хасахаас үл хамааран эцсийн тоог нэг мөр болгоно.
  update perfume_requests
     set vote_count = (select count(*) from perfume_request_votes where request_id = p_target)
   where id = p_target
  returning vote_count into v_count;
  return v_count;
end;
$$;

revoke all on function submit_perfume_request(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function merge_perfume_requests(uuid, uuid)
  from public, anon, authenticated;
do $$ begin
  grant execute on function submit_perfume_request(uuid, text, text, text, text, uuid) to service_role;
  grant execute on function merge_perfume_requests(uuid, uuid) to service_role;
exception when undefined_object then null; end $$;

comment on table perfume_requests is
  'Шинэ үнэртний санал (0137). Нэг үнэртэн = нэг мөр (match_key). '
  'Feature flag `perfume_requests` хаалттай үед submit_perfume_request юу ч үүсгэхгүй.';
