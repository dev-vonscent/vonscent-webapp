-- Нэртэй энгийн хямдрал (task 16.2–16.6). Feature flag `named_sales`.
--
-- Админ → Маркетинг → Хямдрал (0166) нь олон бараанд хэмжээ бүрийн хувиар
-- хугацаатай хямдрал тавьдаг ч «аль хямдралд аль үнэртэн орсон» нь
-- мөрдөгддөггүй байв. Одоо хямдрал бүр нэртэй (`sales`) бөгөөд
-- `product_variants.sale_id` нь тухайн хэмжээний `sale_price`-ийг аль
-- хямдрал бичсэнийг заана.
--
-- Үнийн механизм ӨӨРЧЛӨГДӨХГҮЙ: `sale_price` / `sale_starts_at` /
-- `sale_ends_at` (0166) хэвээр, `variant_price()`, каталог, `place_order`
-- хөндөгдөхгүй. Энэ migration зөвхөн «хэн бичсэн» шошго нэмнэ.
--
-- «Арга хэмжээ» (`sale_events`, 0181) нь тусдаа — энэ нь түүнийг орлохгүй.
--
-- Хуучин нэргүй хямдрал (`sale_price is not null and sale_id is null`) нь
-- өгөгдлийн шилжүүлэлтгүйгээр админы жагсаалтад «Нэргүй» нэг бүлэг болж
-- харагдана (кодоор бүлэглэнэ). Админ түүнийг засаж нэр өгөхөд
-- `save_sale(..., p_adopt_unnamed => true)` хуучин мөрүүдийг шинэ хямдралд
-- шилжүүлнэ.
--
-- Expand only: шинэ хүснэгт, nullable багана, шинэ RPC. Туг хаалттай үед
-- бичих RPC бүр `FEATURE_DISABLED` — prod дээр `sales` хоосон, `sale_id`
-- null хэвээр үлдэнэ. Хуучин `apply_bulk_sale` / `clear_bulk_sale` хэвээр.

insert into feature_flags (key) values ('named_sales') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Хүснэгт, багана.
------------------------------------------------------------------------------

-- `pcts`: {"2": 10, "5": 15, ...} — хямдралын БҮХ бараанд ижил хэмжээ → хувь
-- (0166-ийн олноор тавих урсгалтай ижил). Хугацаа нь админы сонгосон УБ
-- өдрөөс (`dayStartIso` / `dayEndIso`); `ends_at` exclusive.
create table if not exists sales (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  pcts        jsonb not null default '{}'::jsonb,
  starts_at   timestamptz,
  ends_at     timestamptz not null,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sales_period check (starts_at is null or ends_at > starts_at)
);

drop trigger if exists sales_updated_at on sales;
create trigger sales_updated_at
  before update on sales
  for each row execute function set_updated_at();

alter table sales enable row level security;
drop policy if exists "sales staff read" on sales;
create policy "sales staff read" on sales for select using (is_staff());

alter table public.product_variants
  add column if not exists sale_id uuid references sales(id) on delete set null;

create index if not exists product_variants_sale_id_idx
  on product_variants (sale_id) where sale_id is not null;

------------------------------------------------------------------------------
-- 2. Хадгалах. Нэг транзакц, advisory lock (хоёр админ зэрэг хадгалах).
--
-- Алдаа (route handler монгол мессеж болгоно):
--   BAD_NAME / BAD_PCT / BAD_PERIOD / NO_PRODUCTS / NOT_FOUND
--   SALE_CONFLICT — бараа өөр ДУУСААГҮЙ хямдралд байна (16.3);
--                   detail = [{productId, sale}]
--   PRODUCT_WITHOUT_DISCOUNT — бараа 4 хэмжээ бүгдээрээ хямдралгүй
--                   үлдэнэ (16.5); detail = [productId]
------------------------------------------------------------------------------

create or replace function save_sale(
  p_id uuid,
  p_name text,
  p_pcts jsonb,
  p_starts timestamptz,
  p_ends timestamptz,
  p_product_ids uuid[],
  p_adopt_unnamed boolean default false,
  p_actor uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_conflicts jsonb;
  v_bare jsonb;
begin
  if not feature_enabled('named_sales') then
    raise exception 'FEATURE_DISABLED';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 60 then
    raise exception 'BAD_NAME';
  end if;
  if p_ends is null or (p_starts is not null and p_ends <= p_starts) then
    raise exception 'BAD_PERIOD';
  end if;
  if p_pcts is null or jsonb_typeof(p_pcts) <> 'object'
     or not exists (select 1 from jsonb_object_keys(p_pcts))
     or exists (
       select 1 from jsonb_each_text(p_pcts) e
        where e.key not in ('2', '5', '10', '20')
           or e.value !~ '^\d+$'
           or e.value::int not between 1 and 90)
  then
    raise exception 'BAD_PCT';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception 'NO_PRODUCTS';
  end if;

  perform pg_advisory_xact_lock(hashtext('sales'));

  if v_id is not null then
    perform 1 from sales where id = v_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;

  -- 16.3: өөр дуусаагүй хямдралд (нэрт эсвэл «Нэргүй») байгаа бараа.
  select jsonb_agg(distinct jsonb_build_object(
           'productId', v.product_id,
           'sale', coalesce(s.name, 'Нэргүй')))
    into v_conflicts
    from product_variants v
    left join sales s on s.id = v.sale_id
   where v.product_id = any(p_product_ids)
     and v.sale_price is not null
     and (v.sale_ends_at is null or v.sale_ends_at > now())
     and (
       (v.sale_id is not null and v.sale_id is distinct from v_id)
       or (v.sale_id is null and not p_adopt_unnamed)
     );
  if v_conflicts is not null then
    raise exception 'SALE_CONFLICT'
      using errcode = 'exclusion_violation', detail = v_conflicts::text;
  end if;

  -- 16.5: бараа бүрт дор хаяж нэг зарагдах, үнэтэй хэмжээ хямдрах ёстой.
  select jsonb_agg(pid)
    into v_bare
    from unnest(p_product_ids) as pid
   where not exists (
     select 1 from product_variants v
      where v.product_id = pid
        and v.is_active
        and v.price > 0
        and p_pcts ? v.ml::text);
  if v_bare is not null then
    raise exception 'PRODUCT_WITHOUT_DISCOUNT'
      using errcode = 'check_violation', detail = v_bare::text;
  end if;

  if v_id is null then
    insert into sales (name, pcts, starts_at, ends_at, created_by)
    values (btrim(p_name), p_pcts, p_starts, p_ends, p_actor)
    returning id into v_id;
  else
    update sales
       set name = btrim(p_name), pcts = p_pcts,
           starts_at = p_starts, ends_at = p_ends
     where id = v_id;
  end if;

  -- Хасагдсан бараа / хувьгүй болсон хэмжээ → энгийн үнэ.
  update product_variants
     set sale_price = null, sale_starts_at = null, sale_ends_at = null,
         sale_id = null
   where sale_id = v_id
     and (product_id <> all(p_product_ids) or not p_pcts ? ml::text);

  -- «Нэргүй»-г нэрлэх: хуучин нэргүй мөрүүдийг энэ хямдрал бүхэлд нь
  -- орлоно — жагсаалтаас хассан бараа, хувьгүй хэмжээ энгийн үнэ рүүгээ.
  if p_adopt_unnamed then
    update product_variants
       set sale_price = null, sale_starts_at = null, sale_ends_at = null
     where sale_id is null
       and sale_price is not null
       and (product_id <> all(p_product_ids) or not p_pcts ? ml::text);
  end if;

  -- Хувь → үнэ: 0166 `apply_bulk_sale`, 0181 `event_discount_price`-тай
  -- ижил (үндсэн үнээс, 100₮-д дугуйрна, үндсэн үнээс давахгүй).
  update product_variants pv
     set sale_price = event_discount_price(pv.price,
                                           (p_pcts ->> pv.ml::text)::int),
         sale_starts_at = p_starts,
         sale_ends_at = p_ends,
         sale_id = v_id
   where pv.product_id = any(p_product_ids)
     and pv.price > 0
     and p_pcts ? pv.ml::text;

  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- 3. Дуусгах (16.4) — одоо явж буй хямдралыг яг одоо зогсооно. Эхлээгүй
--    хямдралыг дуусгах биш, устгана (`delete_sale`).
------------------------------------------------------------------------------

create or replace function end_sale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s sales;
begin
  if not feature_enabled('named_sales') then
    raise exception 'FEATURE_DISABLED';
  end if;
  perform pg_advisory_xact_lock(hashtext('sales'));
  select * into s from sales where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.ends_at <= now() then raise exception 'ALREADY_ENDED'; end if;
  if s.starts_at is not null and s.starts_at > now() then
    raise exception 'NOT_STARTED';
  end if;

  update sales set ends_at = now() where id = p_id;
  update product_variants set sale_ends_at = now() where sale_id = p_id;
end;
$$;

-- Устгах: хямдралын үнэ шууд арилна (`sale_id` → null, on delete set null-ээс
-- өмнө үнийн баганыг цэвэрлэнэ).
create or replace function delete_sale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not feature_enabled('named_sales') then
    raise exception 'FEATURE_DISABLED';
  end if;
  perform pg_advisory_xact_lock(hashtext('sales'));
  update product_variants
     set sale_price = null, sale_starts_at = null, sale_ends_at = null,
         sale_id = null
   where sale_id = p_id;
  delete from sales where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end;
$$;

revoke all on function save_sale(uuid, text, jsonb, timestamptz, timestamptz, uuid[], boolean, uuid)
  from public, anon, authenticated;
revoke all on function end_sale(uuid) from public, anon, authenticated;
revoke all on function delete_sale(uuid) from public, anon, authenticated;
grant execute on function save_sale(uuid, text, jsonb, timestamptz, timestamptz, uuid[], boolean, uuid)
  to service_role;
grant execute on function end_sale(uuid) to service_role;
grant execute on function delete_sale(uuid) to service_role;
