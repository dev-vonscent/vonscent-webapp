-- 0116 — «Дараа авахаар хадгалах» (клиент, 2026-10)
--
-- Checkout дээр бөглөсөн захиалгыг (мөрүүд + маягтын ноорог) бүртгэлд
-- хадгалж, «Миний захиалга» хэсгээс дараа нь үргэлжлүүлнэ. Өмнө нь
-- localStorage-д байсан: төхөөрөмж хооронд дамждаггүй, хаяг/утас агуулсан
-- ноорог нийтийн компьютерт үлддэг байв.
--
-- Энэ нь ЗАХИАЛГА БИШ: нөөц түгжихгүй, үнэ тогтоохгүй. `items` /
-- `collections` нь сагсны мөрийн хуулбар (харуулах + сагсанд буцаах), үнэ
-- нь хадгалсан үеийнх — захиалахад checkout ба сервер одоогийн үнээр дахин
-- бодно. Хэрэглэгч бүрд дээд тал нь 10 мөр (API хуучныг нь хасна).

create table if not exists saved_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- «Захиалах» замаар ирсэн нэг мөр — сэргээхэд сагсанд биш buy-now болно.
  buy_now boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  collections jsonb not null default '[]'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint saved_checkouts_items_array check (jsonb_typeof(items) = 'array'),
  constraint saved_checkouts_collections_array
    check (jsonb_typeof(collections) = 'array'),
  constraint saved_checkouts_has_lines
    check (jsonb_array_length(items) + jsonb_array_length(collections) > 0)
);

create index if not exists saved_checkouts_user_created_idx
  on saved_checkouts (user_id, created_at desc);

alter table saved_checkouts enable row level security;
drop policy if exists "saved checkout owner" on saved_checkouts;
create policy "saved checkout owner" on saved_checkouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
