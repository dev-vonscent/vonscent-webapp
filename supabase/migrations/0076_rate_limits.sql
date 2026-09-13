-- API-д хүсэлтийн хязгаар (backlog §2.1) — GCRA аргаар, Postgres дээр.
--
-- Яагаад Redis (Upstash) биш вэ: үнэгүй түвшний команд/өдөр квот дуусахад
-- limiter өөрөө унана — яг халдлагын үед. Supabase дээр ийм квот байхгүй,
-- route handler-ууд ямар ч байсан Supabase руу нэг удаа очдог тул нэмэлт
-- сүлжээний алхам бодитоор нэмэгдэхгүй (функц ба DB хоёул Seoul-д, §9.6).
--
-- Яагаад GCRA (leaky bucket, нэг timestamp) вэ, тогтмол цонхны тоолуур биш:
--   * түлхүүр тутамд ЯГ НЭГ мөр — цонх бүрээр мөр хуримтлахгүй, bloat бага;
--   * цонхны зааг дээрх давхар burst гардаггүй (2× алдаа);
--   * түр зуурын burst-ыг зөвшөөрч, дараа нь жигд дусаана.
-- Нэр томьёо: T (emission interval) = цонх / хязгаар, τ (burst) = цонх,
-- TAT = «онолын ирэх хугацаа». Хүсэлт TAT − τ ≤ одоо байвал зөвшөөрнө.

create table if not exists rate_limits (
  -- Аль хамгаалалт вэ (жишээ нь 'contact', 'order') — src/lib/constants.ts.
  bucket text not null,
  -- Хэнийг хэмжиж байна вэ: хэрэглэгчийн id эсвэл IP-ийн sha256 (түүхий
  -- IP-г хадгалахгүй — хувийн мэдээлэл DB-д үлдэх шаардлага байхгүй).
  subject text not null,
  tat timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (bucket, subject)
);

-- Цэвэрлэгээ индексээр явна (доорх prune_rate_limits).
create index if not exists rate_limits_tat_idx on rate_limits (tat);

-- Зөвхөн service role хүрнэ: RLS асаагаад нэг ч policy үлдээхгүй.
alter table rate_limits enable row level security;
revoke all on table rate_limits from anon, authenticated;

-- ── Нэг хүсэлт «зарцуулах» ────────────────────────────────────────────
-- Буцаах: { allowed, retry_after, remaining, limit, reset }
--
-- Атомик байдал: `insert ... on conflict do update ... where` нь мөрийг
-- түгжсэний ДАРАА шинэ утгаар where-ээ шалгадаг тул зэрэг ирсэн хүсэлтүүд
-- цувраа болно — advisory lock, тусдаа транзакц хэрэггүй. where худал бол
-- нэг ч мөр буцахгүй: тэр нь «хязгаар хэтэрлээ» гэсэн үг.
create or replace function consume_rate_limit(
  p_bucket text,
  p_subject text,
  p_limit int,
  p_period_seconds int,
  p_cost int default 1
) returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_emission interval;
  v_burst interval;
  v_new_tat timestamptz;
  v_tat timestamptz;
  v_retry numeric;
  v_remaining int;
begin
  if p_limit < 1 or p_period_seconds < 1 or p_cost < 1 then
    raise exception 'consume_rate_limit: буруу бодлого (limit=%, period=%, cost=%)',
      p_limit, p_period_seconds, p_cost;
  end if;

  -- Нэг хүсэлтийн өртөг нь бүхэл цонхноос давсан бол хэзээ ч багтахгүй.
  if p_cost > p_limit then
    return jsonb_build_object(
      'allowed', false, 'retry_after', p_period_seconds,
      'remaining', 0, 'limit', p_limit, 'reset', p_period_seconds);
  end if;

  v_emission := make_interval(secs => p_period_seconds::numeric / p_limit);
  v_burst := make_interval(secs => p_period_seconds);   -- τ = limit × T

  insert into rate_limits as r (bucket, subject, tat, updated_at)
  values (p_bucket, p_subject, v_now + v_emission * p_cost, v_now)
  on conflict (bucket, subject) do update
     set tat = greatest(r.tat, v_now) + v_emission * p_cost,
         updated_at = v_now
   where greatest(r.tat, v_now) + v_emission * p_cost - v_burst <= v_now
  returning r.tat into v_new_tat;

  if v_new_tat is null then
    -- Хэтэрсэн: мөр хэвээрээ. Хэзээ дахин багтахыг нь тооцоод хэлнэ.
    select r.tat into v_tat
      from rate_limits r
     where r.bucket = p_bucket and r.subject = p_subject;
    v_retry := extract(epoch from
      (greatest(coalesce(v_tat, v_now), v_now) + v_emission * p_cost - v_burst - v_now));
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(v_retry))::int,
      'remaining', 0,
      'limit', p_limit,
      'reset', greatest(1, ceil(extract(epoch from (coalesce(v_tat, v_now) - v_now))))::int);
  end if;

  -- Үлдсэн эрх: хувааж авсан τ-гаас хэр нь чөлөөтэй үлдсэн бэ.
  v_remaining := greatest(0, floor(
    extract(epoch from (v_burst - (v_new_tat - v_now)))
    / extract(epoch from v_emission))::int);

  return jsonb_build_object(
    'allowed', true,
    'retry_after', 0,
    'remaining', v_remaining,
    'limit', p_limit,
    'reset', greatest(0, ceil(extract(epoch from (v_new_tat - v_now))))::int);
end $$;

-- Функцийг зөвхөн service role дуудна (anon key-ээр дуудвал бодлогыг нь
-- дураараа сонгож, хүн бүрийн тоолуурыг гүйцээх боломжтой болно).
revoke all on function consume_rate_limit(text, text, int, int, int) from public;
revoke all on function consume_rate_limit(text, text, int, int, int) from anon, authenticated;

-- ── Цэвэрлэгээ ────────────────────────────────────────────────────────
-- TAT нь өнгөрсөн мөр = бүрэн дүүрсэн хувин: мэдээлэл агуулахаа больсон.
create or replace function prune_rate_limits()
returns int language plpgsql as $$
declare v_deleted int;
begin
  delete from rate_limits where tat < now() - interval '10 minutes';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

do $$
begin
  perform cron.unschedule('prune-rate-limits');
exception when others then null; end $$;

-- Цагт нэг удаа: хүчингүй болсон тоолуурыг устгана (§9.3).
select cron.schedule('prune-rate-limits', '7 * * * *', $$select prune_rate_limits();$$);
