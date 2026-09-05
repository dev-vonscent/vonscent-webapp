-- «Онцлох бараа» таг (backlog C2).
--
-- Нүүрэнд гараар бараа сонгодог «Нүүрийн хэсэг» механизм (0023) аль хэдийн
-- бий. Түүнтэй давхардуулахгүйн тулд бараан дээр is_featured тэмдэг нэмж,
-- home_sections-д шинэ төрөл kind = 'featured' оруулав: тийм хэсэг гараар
-- сонгосон жагсаалт биш, is_featured = true бараануудыг автоматаар харуулна.
-- Админ бараагаа засахдаа «Онцлох» гэж тэмдэглэхэд л нүүрэнд гарна.

alter table products
  add column if not exists is_featured boolean not null default false;

-- Онцлох нь цөөн тул хэсэгчилсэн индекс хангалттай.
create index if not exists products_featured_idx
  on products (created_at desc)
  where is_featured and is_active;

alter table home_sections drop constraint if exists home_sections_kind_check;
alter table home_sections
  add constraint home_sections_kind_check
  check (kind in ('manual', 'tag', 'featured'));

-- 0023-ийн үед үүссэн «Онцлох» хэсэг: админ бараа сонгож амжаагүй бол шинэ
-- автомат төрөл рүү шилжүүлнэ. Гараар сонгосон жагсаалттай бол хэвээр
-- үлдээнэ — админы хийсэн ажлыг эвдэхгүй.
update home_sections s
   set kind = 'featured',
       href = case when s.href = '' then '/catalog?featured=1' else s.href end
 where s.title = 'Онцлох'
   and s.kind = 'manual'
   and not exists (
     select 1 from home_section_products p where p.section_id = s.id
   );
