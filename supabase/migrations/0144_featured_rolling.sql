-- «Онцлох» — хамгийн сүүлд онцлох болгосон 12 зүйл (ус + багц нийлээд).
--
-- Клиент (2026-10): ус, багцыг 6/6 гэж хуваахгүй. Онцлох болгосон дарааллаар
-- нь шинэ нь эхэндээ жагсана. 13 дахийг онцлох болгоход хамгийн эрт онцлох
-- болсон нь (ус ч бай, багц ч бай) автоматаар онцлохоос хасагдана.
--
-- `is_featured` нь тийм/үгүй л байсан — ХЭЗЭЭ онцлох болсныг мэдэхгүй тул
-- `featured_at` нэмнэ (expand only: nullable, хуучин код үл тооно).
--
-- Одоо 12-оос олон онцлох байвал хасахгүй (клиентийн шийдвэр): нүүр хамгийн
-- сүүлийн 12-ыг л харуулна, дараагийн онцлох нэмэх үед илүүдэл нь хасагдана.
-- Тоо нь FEATURED_LIMIT (src/lib/constants.ts)-тэй ижил байх ёстой.

alter table products add column if not exists featured_at timestamptz;
alter table collections add column if not exists featured_at timestamptz;

-- 0131: products-ийн SELECT баганаар өгөгддөг — шинэ багана нийтэд харагдахгүй.
grant select (featured_at) on products to anon, authenticated;

-- Хэзээ онцлох болсныг мэдэхгүй тул сүүлд засагдсан огноогоор эхлүүлнэ.
update products set featured_at = updated_at
 where is_featured and featured_at is null;
update collections set featured_at = updated_at
 where is_featured and featured_at is null;

-- ── featured_at-ыг is_featured дагуулна ─────────────────────────────────
create or replace function trg_set_featured_at()
returns trigger
language plpgsql
as $$
begin
  if not new.is_featured then
    new.featured_at := null;
  elsif tg_op = 'INSERT' or not old.is_featured then
    new.featured_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_featured_at on products;
create trigger products_set_featured_at
  before insert or update of is_featured on products
  for each row execute function trg_set_featured_at();

drop trigger if exists collections_set_featured_at on collections;
create trigger collections_set_featured_at
  before insert or update of is_featured on collections
  for each row execute function trg_set_featured_at();

-- ── 12-оос хэтэрвэл хамгийн эртнийг хасна ───────────────────────────────
create or replace function enforce_featured_limit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select 'product' as kind, id, featured_at from products where is_featured
    union all
    select 'collection', id, featured_at from collections
     where is_featured and type = 'base'
  ),
  overflow as (
    select kind, id from ranked
     order by featured_at desc nulls last, id
    offset 12
  ),
  p as (
    update products set is_featured = false
     where id in (select id from overflow where kind = 'product')
  )
  update collections set is_featured = false
   where id in (select id from overflow where kind = 'collection');
end;
$$;

revoke all on function enforce_featured_limit() from public, anon, authenticated;

create or replace function trg_enforce_featured_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Зөвхөн ШИНЭЭР онцлох болоход. Хасах (true → false) нь дахин дуудахгүй
  -- тул enforce_featured_limit()-ийн өөрийн update давталт үүсгэхгүй.
  if new.is_featured and (tg_op = 'INSERT' or not old.is_featured) then
    perform enforce_featured_limit();
  end if;
  return null;
end;
$$;

drop trigger if exists products_enforce_featured_limit on products;
create trigger products_enforce_featured_limit
  after insert or update of is_featured on products
  for each row execute function trg_enforce_featured_limit();

drop trigger if exists collections_enforce_featured_limit on collections;
create trigger collections_enforce_featured_limit
  after insert or update of is_featured on collections
  for each row execute function trg_enforce_featured_limit();
