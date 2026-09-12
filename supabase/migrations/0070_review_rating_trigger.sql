-- Үнэлгээний нийлбэрийг trigger-т шилжүүлэх.
--
-- Асуудал: `POST /api/reviews` нь эхлээд `reviews`-д upsert хийгээд, дараа нь
-- тусад нь `recompute_rating` RPC дууддаг байв — хоёр тусдаа бичилт, нэг нь
-- нөгөөгөө баталгаажуулдаггүй. RPC амжилтгүй болвол (үр дүн нь шалгагддаггүй
-- байсан) `products.rating_avg/rating_count` үүрд зөрнө. DELETE дээр бүр
-- эмзэг: бүтээгдэхүүний ID нь query string-ээс ирдэг тул клиент дамжуулаагүй
-- бол нийлбэр чимээгүйхэн хуучраад үлддэг. Хэрэглэгч эсвэл бүтээгдэхүүн
-- устахад cascade-аар алга болсон сэтгэгдлүүд ч тооллогод үлдсээр байв.
--
-- Шийдэл: нийлбэрийг `reviews` дээрх trigger-ээр өөрөө нь бодуулна. Ямар ч
-- замаар (route, админ, SQL, cascade) сэтгэгдэл өөрчлөгдсөн ч нийлбэр үргэлж
-- зөв болж, дуудагчийн сахилга батаас хамаарахаа болино.
--
-- `recompute_rating` нь `products`-ыг шинэчилдэг ба тэнд RLS нь зөвхөн
-- ажилтанд бичих эрх өгдөг (0009). Trigger нь сэтгэгдэл бичсэн хэрэглэгчийн
-- эрхээр ажиллах тул `security definer` болгож байж update нь нэвтэрнэ
-- (өмнө нь route үүнийг service-role client-ээр тойрч байсан).

create or replace function recompute_rating(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_cnt int;
begin
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
    into v_avg, v_cnt from reviews where product_id = p_product;
  update products set rating_avg = v_avg, rating_count = v_cnt where id = p_product;
end $$;

create or replace function reviews_rating_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_rating(old.product_id);
    return null;
  end if;

  perform recompute_rating(new.product_id);
  -- Сэтгэгдэл өөр бүтээгдэхүүн рүү шилжсэн бол хуучныг нь ч дахин бодно.
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform recompute_rating(old.product_id);
  end if;
  return null;
end $$;

drop trigger if exists reviews_rating_sync on reviews;
create trigger reviews_rating_sync
  after insert or update or delete on reviews
  for each row execute function reviews_rating_sync();

-- Trigger орохоос өмнө үүссэн зөрүүг нэг удаа тэгшитгэнэ.
update products p set
  rating_avg = r.avg_rating,
  rating_count = r.cnt
from (
  select p2.id,
         coalesce(round(avg(rv.rating)::numeric, 1), 0) as avg_rating,
         count(rv.id) as cnt
  from products p2
  left join reviews rv on rv.product_id = p2.id
  group by p2.id
) r
where p.id = r.id
  and (p.rating_avg is distinct from r.avg_rating
    or p.rating_count is distinct from r.cnt);

-- Trigger дотроос (эзэмшигчийн эрхээр) дуудагдана. Гаднаас PostgREST RPC-ээр
-- дуудах хэрэглэгч үлдээгүй тул `security definer` функцийн гадаргууг хаая.
revoke execute on function recompute_rating(uuid) from public, anon, authenticated;
