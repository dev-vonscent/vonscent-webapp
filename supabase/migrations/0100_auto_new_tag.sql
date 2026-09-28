-- «Шинэ» таг автомат болов: хамгийн сүүлд нэмэгдсэн 12 идэвхтэй ус.
--
-- Өмнө нь админ бараа бүр дээр «Шинэ» checkbox-ыг гараар чагталдаг байсан,
-- хугацаа ч байхгүй байв. Тиймээс хуучин бараа «Шинэ» хэвээр үлдэх эсвэл
-- шинэ бараа тэмдэглэгдэхгүй өнгөрөх явдал гардаг байв. Одоо дүрэм ганц:
-- `created_at`-аар хамгийн сүүлийн NEW_PRODUCTS_COUNT (= 12,
-- src/lib/constants.ts) идэвхтэй бараа «Шинэ». 13 дахь ус нэмэгдэхэд хамгийн
-- хуучин нь өөрөө гарна.
--
-- Хадгалах байршил нь хуучин `product_tags` хэвээр. Каталог, badge, нүүрний
-- хэсэг, related зэрэг уншдаг бүх газар өөрчлөгдөхгүй. Зөвхөн бичилт нь DB-ийн
-- мэдэлд шилжинэ:
--   * products-ийн нэмэх/устгах/идэвхжүүлэх бүрийн дараа жагсаалтыг дахин
--     тооцно (AI зурагтай бараа нуугдмал үүсч, дараа нь идэвхжих үедээ ордог);
--   * гараар (route, seed, import скрипт) оруулсан `new` холбоосыг чимээгүй
--     алгасна, гараар устгасныг буцааж тавина.

create or replace function refresh_new_tag()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag uuid;
begin
  select id into v_tag from tags where kind = 'new' order by slug limit 1;
  if v_tag is null then
    return;
  end if;

  -- Доорх бичилтүүд өөрийн trigger-үүдийг дахин өдөөхгүй, `new` оруулахыг
  -- ч хориглуулахгүй байх тэмдэг (транзакц дотор, төгсгөлд нь буцаана).
  perform set_config('vonscent.new_tag_sync', 'on', true);

  -- Жагсаалтаас гарсныг л хасаж, дутууг л нэмнэ: 12 мөрийг байнга
  -- устгаж/нэмэхгүй.
  delete from product_tags pt
   where pt.tag_id = v_tag
     and pt.product_id not in (
       select p.id from products p
        where p.is_active
        order by p.created_at desc, p.id desc
        limit 12);

  insert into product_tags (product_id, tag_id)
  select p.id, v_tag
    from products p
   where p.is_active
   order by p.created_at desc, p.id desc
   limit 12
  on conflict do nothing;

  perform set_config('vonscent.new_tag_sync', 'off', true);
end;
$$;

revoke all on function refresh_new_tag() from public, anon, authenticated;

-- Statement түвшинд: олон мөр нэг дор импортлоход нэг л удаа тооцно.
create or replace function trg_refresh_new_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- refresh_new_tag() өөрөө product_tags руу бичдэг тул давхар дуудагдахгүй.
  if current_setting('vonscent.new_tag_sync', true) = 'on' then
    return null;
  end if;
  perform refresh_new_tag();
  return null;
end;
$$;

-- Гараар `new` холбоос оруулахыг алгасна. Зөвхөн refresh_new_tag() оруулж
-- чадна.
create or replace function trg_skip_manual_new_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('vonscent.new_tag_sync', true), 'off') <> 'on'
     and exists (select 1 from tags t where t.id = new.tag_id and t.kind = 'new') then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists products_refresh_new_tag on products;
create trigger products_refresh_new_tag
  after insert or delete or update of is_active, created_at on products
  for each statement execute function trg_refresh_new_tag();

drop trigger if exists product_tags_refresh_new_tag on product_tags;
create trigger product_tags_refresh_new_tag
  after insert or update or delete on product_tags
  for each statement execute function trg_refresh_new_tag();

drop trigger if exists product_tags_skip_manual_new on product_tags;
create trigger product_tags_skip_manual_new
  before insert or update on product_tags
  for each row execute function trg_skip_manual_new_tag();

-- Одоогийн гар тэмдэглэгээг цэвэрлэж, шинэ дүрмээр нэг удаа тооцно.
delete from product_tags pt
 using tags t
 where t.id = pt.tag_id and t.kind = 'new';
select refresh_new_tag();
