-- «Эрэлттэй» таг автомат болов: бодит борлуулалтаар хамгийн их зарагдсан 12
-- идэвхтэй ус.
--
-- Нүүрний «Эрэлттэй» хэсэг `top_seller_products()`-оор (0034) борлуулалтаас
-- автоматаар гардаг байсан. Гэтэл каталогийн «Эрэлттэй» chip нь админы гараар
-- тавьдаг `hot` тагаар шүүдэг тул хоосон байв. Одоо хоёр ижил дүрэмтэй:
-- төлөгдсөн захиалгын (бэлэг биш) ширхэгийн нийлбэрээр хамгийн их зарагдсан
-- HOT_PRODUCTS_COUNT (= 12, src/lib/constants.ts) идэвхтэй ус.
--
-- «Шинэ» (0100)-тэй ижил загвартай: хадгалах байршил нь `product_tags` хэвээр,
-- бичилт нь зөвхөн DB-ийн мэдэлд. Захиалга төлөгдөх эсвэл буцаагдах, бараа
-- идэвхжих эсвэл нуугдах бүрт дахин тооцно. Гараар оруулсан `hot` холбоосыг
-- алгасна. Борлуулалт огт байхгүй бол таг ч хоосон байна.

-- Эрэмбэ: `top_seller_products()`-тэй ижил тооцоо, зөвхөн идэвхтэй ус.
create or replace function hot_product_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select oi.product_id
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
   where o.payment_status = 'paid'
     and oi.is_gift = false
     and p.is_active
   group by oi.product_id
   order by sum(oi.qty) desc, oi.product_id
   limit 12;
$$;

revoke all on function hot_product_ids() from public, anon, authenticated;

create or replace function refresh_hot_tag()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag uuid;
begin
  select id into v_tag from tags where kind = 'hot' order by slug limit 1;
  if v_tag is null then
    return;
  end if;

  perform set_config('vonscent.new_tag_sync', 'on', true);

  delete from product_tags pt
   where pt.tag_id = v_tag
     and pt.product_id not in (select hot_product_ids());

  insert into product_tags (product_id, tag_id)
  select id, v_tag from hot_product_ids() id
  on conflict do nothing;

  perform set_config('vonscent.new_tag_sync', 'off', true);
end;
$$;

revoke all on function refresh_hot_tag() from public, anon, authenticated;

-- Бараа эсвэл тагийн бичилт хоёр автомат тагт хоёуланд нь нөлөөлнө.
create or replace function trg_refresh_new_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- refresh_*_tag() өөрсдөө product_tags руу бичдэг тул давхар дуудагдахгүй.
  if current_setting('vonscent.new_tag_sync', true) = 'on' then
    return null;
  end if;
  perform refresh_new_tag();
  perform refresh_hot_tag();
  return null;
end;
$$;

-- Захиалгын төлбөрийн төлөв зөвхөн «Эрэлттэй»-д нөлөөлнө.
create or replace function trg_refresh_hot_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('vonscent.new_tag_sync', true) = 'on' then
    return null;
  end if;
  perform refresh_hot_tag();
  return null;
end;
$$;

-- Гараар `new`, `hot` холбоос оруулахыг алгасна (`sale` гараар хэвээр).
create or replace function trg_skip_manual_new_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('vonscent.new_tag_sync', true), 'off') <> 'on'
     and exists (select 1 from tags t
                  where t.id = new.tag_id and t.kind in ('new', 'hot')) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_refresh_hot_tag on orders;
create trigger orders_refresh_hot_tag
  after update of payment_status or delete on orders
  for each statement execute function trg_refresh_hot_tag();

-- Одоогийн гар тэмдэглэгээг цэвэрлэж, шинэ дүрмээр нэг удаа тооцно.
delete from product_tags pt
 using tags t
 where t.id = pt.tag_id and t.kind = 'hot';
select refresh_hot_tag();
