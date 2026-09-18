-- Үнэртний төрөл (концентраци): хаалттай enum-ээс админы удирддаг хүснэгт рүү.
--
-- `concentration_t` enum нь migration бичихээс өөр замаар өргөжихгүй байсан
-- тул шинэ ус авахад (Eau Fraîche, Attar, Perfume Oil, Body Mist …) админ
-- төрлийг нь бүртгэж чаддаггүй байв. `scent_families` (0018), `custom_tags`
-- (0035), `brands` (0050)-тай ижил загвараар админ өөрөө нэмж, засаж,
-- устгадаг хүснэгт болголоо.
--
-- `products.concentration` нь товчлолыг (code) шууд хадгална — уншигч код
-- бүр (каталог RPC, quiz, барааны хуудас) аль хэдийн тэр текстийг харуулдаг
-- тул id рүү шилжүүлэх нь ашиггүй өөрчлөлт болно. Хамаарлыг FK хамгаална:
-- `on update cascade` нь нэр засахад бараануудыг дагуулж, `on delete restrict`
-- нь ашиглагдаж байгаа төрлийг устгуулахгүй.

create table if not exists concentrations (
  id uuid primary key default gen_random_uuid(),
  -- Барааны хуудсанд харагддаг товчлол: «EDP», «Extrait».
  code text not null,
  -- Бүтэн нэр: «Eau de Parfum». Сонголтын жагсаалтад тайлбар болж харагдана.
  label text not null default '',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- FK нь заавал unique багана заах ёстой — энэ индекс нь мөн `on conflict`-ийн
-- зорилтот түлхүүр.
create unique index if not exists concentrations_code_key
  on concentrations (code);

-- Салбартаа тогтсон бүх төрлийг урьдчилж дүүргэнэ: админ ихэнх тохиолдолд
-- шинээр бичих биш, бэлнээс сонгоно. Дараалал нь хүчнээс сул руу.
insert into concentrations (code, label, sort_order) values
  ('Extrait',     'Extrait de Parfum',  10),
  ('Parfum',      'Parfum',             20),
  ('Elixir',      'Elixir',             30),
  ('EDP',         'Eau de Parfum',      40),
  ('EDT',         'Eau de Toilette',    50),
  ('EDC',         'Eau de Cologne',     60),
  ('Eau Fraiche', 'Eau Fraîche',        70),
  ('Perfume Oil', 'Үнэрийн тос',        80),
  ('Attar',       'Attar',              90),
  ('Body Mist',   'Body Mist',         100),
  ('Hair Mist',   'Hair Mist',         110)
on conflict (code) do nothing;

-- enum → text. Хоёр бэрхшээл:
--
--   1. Анхдагчийг эхлээд хасахгүй бол төрөл хөрвүүлэлт унана.
--   2. `catalog_items` (0059) нь `p.concentration::text`-ийг уншдаг тул
--      Postgres «cannot alter type of a column used by a view or rule» гэж
--      зогсоно. View-ийг тайлж, хөрвүүлээд, дахин үүсгэнэ.
--
-- View-ийн биеийг энд ХУУЛААГҮЙ: `pg_get_viewdef()`-ээр сангаас байгаагаар нь
-- авч, дараа нь тэр чигээр буцаана. Ингэснээр 0059-ийг (эсвэл дараа нь түүнийг
-- өөрчилсөн migration-ийг) хоёр газар нийцүүлэн засах шаардлага гарахгүй.
-- `drop view` нь тайлбар, эрх, `security_invoker`-ыг авч хаядаг тул гурвуулаа
-- гараар нөхөгдөнө.
do $$
declare
  v_view regclass := to_regclass('public.catalog_items');
  v_def text;
  v_comment text;
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_name = 'products'
       and column_name = 'concentration'
       and udt_name = 'concentration_t'
  ) then
    return;
  end if;

  if v_view is not null then
    select pg_get_viewdef(v_view, true),
           obj_description(v_view, 'pg_class')
      into v_def, v_comment;
    drop view public.catalog_items;
  end if;

  alter table products alter column concentration drop default;
  alter table products
    alter column concentration type text using concentration::text;
  alter table products alter column concentration set default 'EDP';

  if v_def is not null then
    -- 0059-ийн `security_invoker = true`: RLS нь дуудагчийн эрхээр үйлчилнэ.
    -- reloptions нь viewdef-д ороогүй тул тусад нь тавина.
    execute 'create view public.catalog_items with (security_invoker = true) as '
      || v_def;
    if v_comment is not null then
      execute format('comment on view public.catalog_items is %L', v_comment);
    end if;
    execute 'grant select on public.catalog_items to anon, authenticated';
  end if;
end $$;

-- Каталогт байгаа ч дээрх жагсаалтад ороогүй утга байвал FK унана — бодит
-- өгөгдлөөс нөхөж бүртгэнэ (label-г админ дараа нь бөглөнө).
insert into concentrations (code, label, sort_order)
select distinct p.concentration, '', 200
  from products p
 where p.concentration is not null
   and p.concentration <> ''
on conflict (code) do nothing;

alter table products drop constraint if exists products_concentration_fkey;
alter table products
  add constraint products_concentration_fkey
  foreign key (concentration) references concentrations (code)
  on update cascade on delete restrict;

-- Хүснэгт үүссэн тул enum нь ашиглагдахаа больсон: үлдээвэл `db:types` дээр
-- хуучин хаалттай жагсаалт дахин гарч ирнэ.
drop type if exists concentration_t;

alter table concentrations enable row level security;

-- Уншихыг бүгдэд (каталог, барааны хуудас); бичилт зөвхөн admin API (service
-- role) дундуур.
drop policy if exists "concentrations read" on concentrations;
create policy "concentrations read" on concentrations
  for select using (true);
