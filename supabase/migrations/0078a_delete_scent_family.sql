-- Үнэрийн төрлийг бүрмөсөн устгах (админ → Тохиргоо → Үнэрийн төрөл).
--
-- Өмнө нь устгах арга байгаагүй — зөвхөн нуух (`is_active = false`). Тэр нь
-- «клиентээс ирсэн жагсаалтад байхгүй» төрлийг арилгах хэрэгцээг хаадаггүй:
-- нуусан төрөл админы жагсаалтад үүрд үлдэж, барааны маягт дээр ч дахин
-- гарч ирдэг.
--
-- Устгалт нь ХОЁР бичилт: `products.scent_families` бол slug-уудын массив
-- (гадаад түлхүүр БИШ, тиймээс cascade байхгүй) тул мөрийг нь устгахын өмнө
-- бараа бүрээс тэр slug-ийг хасах ёстой. Хоёрыг тусад нь хийвэл дунд нь
-- тасарсан тохиолдолд каталогт «үл мэдэгдэх төрөл» үлдэнэ — тиймээс нэг
-- функц, нэг гүйлгээ (development.md: олон бичилттэй үйлдэл RPC дотор).
--
-- Буцаах утга: slug нь хасагдсан барааны тоо, ө.х. админд «энэ устгалт хэдэн
-- бараанд хүрлээ» гэж хэлэх тоо.
create or replace function delete_scent_family(p_slug text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  touched int;
begin
  update products
     set scent_families = array_remove(scent_families, p_slug)
   where p_slug = any(scent_families);
  get diagnostics touched = row_count;

  delete from scent_families where slug = p_slug;
  return touched;
end;
$$;

-- Зөвхөн server талын service-role дуудна (`app/api/admin/...`). Дэлгүүрийн
-- нийтийн клиент энэ функцэд хүрэх шаардлагагүй.
revoke all on function delete_scent_family(text) from public;
revoke all on function delete_scent_family(text) from anon;
revoke all on function delete_scent_family(text) from authenticated;
