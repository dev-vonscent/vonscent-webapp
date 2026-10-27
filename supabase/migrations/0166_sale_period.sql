-- Хугацаатай хямдрал + Админ → Каталог → Хямдрал (feature flag `sale_page`).
--
-- Хэмжээ (variant) бүрийн хямдарсан үнэ (0054a) одоо эхлэх / дуусах
-- хугацаатай болно. Хугацаа дуусмагц үнэ өөрөө үндсэн үнэ рүүгээ буцна —
-- `sale_price` мөр хэвээр үлдэх тул админ дараа нь дахин хугацаа тавьж болно.
-- Багцын үнэ (`collection_ml_discounts`) хамаарахгүй.
--
-- Өмнө нь админ барааг нэг бүрчлэн нээж хямдарсан үнийг гараар бичдэг байв.
-- Одоо бараануудаа сонгоод (бүгд / эрэгтэй / брэнд …) хэмжээ бүрт хувь өгнө
-- (§4, `apply_bulk_sale`). Хэрэглэгчийн талд шинэ хуудас байхгүй.
--
-- Expand only: nullable хоёр багана, шинэ RPC. Хугацаа хоёулаа null =
-- өмнөх шигээ байнгын хямдрал — хуучин код өөрчлөлтгүй ажиллана.

insert into feature_flags (key) values ('sale_page') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Хугацааны баганууд.
------------------------------------------------------------------------------

alter table public.product_variants
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz;

do $$
begin
  alter table public.product_variants
    add constraint product_variants_sale_period
    check (sale_starts_at is null or sale_ends_at is null
           or sale_ends_at > sale_starts_at);
exception
  when duplicate_object then null;
end $$;

------------------------------------------------------------------------------
-- 2. Хямдрал яг одоо хүчинтэй эсэх — үнэ, таг хоёулаа үүнийг уншина.
--    TS талын толь: `isSaleActive()` (src/features/products/sale.ts).
--
--    `now()` уншдаг тул `stable` (0054a-ийн `variant_price` нь `immutable`
--    байсан — хугацаагүй үед л үнэн).
------------------------------------------------------------------------------

create or replace function variant_sale_active(v product_variants)
returns boolean language sql stable as $$
  select v.sale_price is not null
     and v.sale_price < v.price
     and (v.sale_starts_at is null or v.sale_starts_at <= now())
     and (v.sale_ends_at is null or v.sale_ends_at > now());
$$;

-- Төлбөр тооцох цорын ганц цэг (0054a §3) — захиалгын бүх RPC, каталог,
-- хайлт энэ функцээр үнээ авдаг тул хугацаа нэг дор бүх урсгалд үйлчилнэ.
create or replace function variant_price(v product_variants)
returns int language sql stable as $$
  select case when variant_sale_active(v) then v.sale_price else v.price end;
$$;

------------------------------------------------------------------------------
-- 3. «Хямдрал» таг (0103) — зөвхөн одоо хүчинтэй хямдрал.
------------------------------------------------------------------------------

create or replace function sale_product_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct v.product_id
    from product_variants v
    join products p on p.id = v.product_id
   where p.is_active
     and v.is_active
     and variant_sale_active(v);
$$;

revoke all on function sale_product_ids() from public, anon, authenticated;

drop trigger if exists product_variants_refresh_sale_tag on product_variants;
create trigger product_variants_refresh_sale_tag
  after insert or delete
     or update of price, sale_price, sale_starts_at, sale_ends_at, is_active
  on product_variants
  for each statement execute function trg_refresh_sale_tag();

-- Хугацаа эхлэх / дуусах нь бичилтгүйгээр болдог тул тагийг цагаар дахин
-- тооцно. Ялгаатай мөрийг л хөдөлгөдөг тул хоосон давталт хямд.
select cron.unschedule('refresh-sale-tag')
 where exists (select 1 from cron.job where jobname = 'refresh-sale-tag');
select cron.schedule('refresh-sale-tag', '* * * * *', $$select refresh_sale_tag();$$);

select refresh_sale_tag();

------------------------------------------------------------------------------
-- 4. Олноор хямдрал тавих / цуцлах (Админ → Каталог → Хямдрал).
--    Бичилт нь service-role-оор (route handler staff эрхийг шалгасны дараа).
------------------------------------------------------------------------------

-- p_pcts: {"2": 10, "5": 15, ...} — хэмжээ → хувь (1–90). Байхгүй хэмжээнд
-- хүрэхгүй. Үнэ 100₮-д дугуйрна (0054a-тай ижил).
create or replace function apply_bulk_sale(
  p_product_ids uuid[],
  p_pcts jsonb,
  p_starts timestamptz,
  p_ends timestamptz
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not feature_enabled('sale_page') then
    raise exception 'FEATURE_DISABLED';
  end if;
  if p_starts is not null and p_ends is not null and p_ends <= p_starts then
    raise exception 'BAD_PERIOD';
  end if;
  if exists (
    select 1 from jsonb_each_text(p_pcts) e
     where e.value::numeric < 1 or e.value::numeric > 90
  ) then
    raise exception 'BAD_PCT';
  end if;

  update product_variants pv
     set sale_price = least(
           pv.price,
           (round(pv.price * (100 - (p_pcts ->> pv.ml::text)::numeric)
                  / 100 / 100) * 100)::int
         ),
         sale_starts_at = p_starts,
         sale_ends_at = p_ends
   where pv.product_id = any(p_product_ids)
     and pv.price > 0
     and p_pcts ? pv.ml::text;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Сонгосон бараануудын бүх хэмжээний хямдрал (үнэ + хугацаа) цэвэрлэнэ.
create or replace function clear_bulk_sale(p_product_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not feature_enabled('sale_page') then
    raise exception 'FEATURE_DISABLED';
  end if;

  update product_variants
     set sale_price = null, sale_starts_at = null, sale_ends_at = null
   where product_id = any(p_product_ids)
     and (sale_price is not null or sale_starts_at is not null
          or sale_ends_at is not null);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function apply_bulk_sale(uuid[], jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function clear_bulk_sale(uuid[]) from public, anon, authenticated;
grant execute on function apply_bulk_sale(uuid[], jsonb, timestamptz, timestamptz)
  to service_role;
grant execute on function clear_bulk_sale(uuid[]) to service_role;
