-- «Хямдрал» таг автомат болов: идэвхтэй хэмжээнийх нь аль нэг нь хямдралтай
-- үнэтэй (`sale_price < price`, 0054a) идэвхтэй ус.
--
-- Хямдрал 0054a-аас хойш хэмжээ тус бүрийн бодит үнэ болсон ч «Хямдрал»
-- badge, каталогийн chip, нүүрний «Хямдралтай үнэртнүүд» хэсэг нь админы
-- гараар чагталдаг `sale` тагаас хамаардаг байв. Тиймээс хямдрал бичээд
-- тагаа мартвал бараа хямдралын жагсаалтад гардаггүй, хямдрал дууссан ч таг
-- үлдвэл хямдралгүй бараан дээр «Хямдрал» гэж худал бичигддэг байв.
--
-- «Шинэ» (0100), «Эрэлттэй» (0101)-тэй ижил загвартай: хадгалах байршил нь
-- `product_tags` хэвээр, бичилт нь зөвхөн DB-ийн мэдэлд. Хэмжээний үнэ,
-- идэвхтэй эсэх өөрчлөгдөх, бараа идэвхжих эсвэл нуугдах бүрт дахин тооцно.
-- Гараар оруулсан `sale` холбоосыг алгасна. Ингэснээр гараар тавьдаг таг
-- огт үлдэхгүй.

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
     and v.sale_price is not null
     and v.sale_price < v.price;
$$;

revoke all on function sale_product_ids() from public, anon, authenticated;

create or replace function refresh_sale_tag()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag uuid;
begin
  select id into v_tag from tags where kind = 'sale' order by slug limit 1;
  if v_tag is null then
    return;
  end if;

  perform set_config('vonscent.new_tag_sync', 'on', true);

  delete from product_tags pt
   where pt.tag_id = v_tag
     and pt.product_id not in (select sale_product_ids());

  insert into product_tags (product_id, tag_id)
  select id, v_tag from sale_product_ids() id
  on conflict do nothing;

  perform set_config('vonscent.new_tag_sync', 'off', true);
end;
$$;

revoke all on function refresh_sale_tag() from public, anon, authenticated;

-- Бараа эсвэл тагийн бичилт автомат гурван тагт бүгдэд нь нөлөөлнө.
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
  perform refresh_sale_tag();
  return null;
end;
$$;

-- Хэмжээний үнэ, идэвхтэй эсэх зөвхөн «Хямдрал»-д нөлөөлнө.
create or replace function trg_refresh_sale_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('vonscent.new_tag_sync', true) = 'on' then
    return null;
  end if;
  perform refresh_sale_tag();
  return null;
end;
$$;

-- Гараар `new`, `hot`, `sale` холбоос оруулахыг алгасна.
create or replace function trg_skip_manual_new_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('vonscent.new_tag_sync', true), 'off') <> 'on'
     and exists (select 1 from tags t
                  where t.id = new.tag_id
                    and t.kind in ('new', 'hot', 'sale')) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_refresh_sale_tag on product_variants;
create trigger product_variants_refresh_sale_tag
  after insert or delete or update of price, sale_price, is_active
  on product_variants
  for each statement execute function trg_refresh_sale_tag();

-- Одоогийн гар тэмдэглэгээг цэвэрлэж, шинэ дүрмээр нэг удаа тооцно.
delete from product_tags pt
 using tags t
 where t.id = pt.tag_id and t.kind = 'sale';
select refresh_sale_tag();
