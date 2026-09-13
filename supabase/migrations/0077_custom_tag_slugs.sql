-- Нэмэлт таг: slug-ийн нэгдсэн орон зай (quiz-ийн жин slug-аар тулгагддаг).
--
-- 0044 санг латин slug-аар үрсэлсэн (`vanilla`, `office` …) боловч админ
-- хуудсаар нэмсэн таг бүр нэрнээсээ кирилл slug авдаг тул `Ваниль` нэртэй
-- ХОЁР таг (`vanilla` ба `ваниль`) зэрэгцэн үүсч, бараа аль нэг дээр нь
-- унаж байв. Quiz (`features/quiz/questions.ts`) slug-ийг шууд бичдэг тул
-- кирилл slug-тай таг оноонд огт нөлөөлөхгүй чимээгүй унтардаг.
--
-- Энд: (1) нэр нь ижил давхардлыг үндсэн таг руу нэгтгэнэ, (2) үлдсэн кирилл
-- slug-ийг латин руу буулгана. Барааны холбоос устахгүй — давхардсан таг дээр
-- байсан бараа үндсэн таг руу зөөгдөнө. Таг өөрөө нэг ч устахгүй (нэгтгэсэн
-- давхардлаас бусад) тул админы оруулсан мэдээлэл хэвээр.

-- 1) Давхардсан таг → үндсэн таг (барааны холбоосыг эхлээд зөөнө).
create temporary table tag_merge (dup text primary key, keep text not null)
  on commit drop;
insert into tag_merge (dup, keep) values
  ('ваниль',             'vanilla'),
  ('оффис',              'office'),
  ('ажлын-өдөр',         'office'),
  ('цэвэрхэн',           'clean'),
  ('өөрийн-гэсэн-үнэр',  'signature'),
  ('нунтаг-зөөлөн',      'powdery'),
  ('далайн-сэнгэнэсэн',  'marine'),
  ('услаг',              'marine'),
  ('уд-мод',             'oud'),
  ('болзоо',             'date'),
  ('романтик-орой',      'date'),
  ('дэгжин',             'mature'),
  ('арьслаг',            'leather');

insert into product_custom_tags (product_id, tag_id)
select pt.product_id, k.id
from tag_merge m
join custom_tags d on d.slug = m.dup
join custom_tags k on k.slug = m.keep
join product_custom_tags pt on pt.tag_id = d.id
on conflict do nothing;

insert into collection_custom_tags (collection_id, tag_id)
select ct.collection_id, k.id
from tag_merge m
join custom_tags d on d.slug = m.dup
join custom_tags k on k.slug = m.keep
join collection_custom_tags ct on ct.tag_id = d.id
on conflict do nothing;

-- Холбоосууд on delete cascade-аар цэвэрлэгдэнэ.
delete from custom_tags c using tag_merge m where c.slug = m.dup;

-- 2) Үлдсэн кирилл slug → латин. Нэр (админд харагдах текст) хэвээр.
--    `daily`, `smoky` мөр нь 0044-өөс устсан тул зөрчил гарахгүй.
update custom_tags c set slug = r.new_slug
from (values
  ('өдөр-тутмын',      'daily'),
  ('утаат',            'smoky'),
  ('модлог',           'woody'),
  ('цитрус',           'citrus'),
  ('цэнгэг',           'fresh'),
  ('амтлаг',           'gourmand'),
  ('анхилуун',         'aromatic'),
  ('жимслэг',          'fruity'),
  ('тансаг',           'luxurious'),
  ('дулаан',           'warm'),
  ('зун',              'summer'),
  ('өвөл',             'winter'),
  ('намар',            'autumn'),
  ('хавар',            'spring'),
  ('бүх-улирал',       'all-season'),
  ('цай',              'tea'),
  ('ногоон',           'green'),
  ('алимлаг',          'apple'),
  ('жүржлэг',          'orange'),
  ('гашуун-бүйлс',     'bitter-almond'),
  ('жүржийн-цэцэг',    'orange-blossom'),
  ('зөгийн-баллаг',    'honey'),
  ('кардамон',         'cardamom'),
  ('кокос',            'coconut'),
  ('пачули',           'patchouli'),
  ('металлаг',         'metallic'),
  ('минерал',          'mineral'),
  ('минималист',       'minimalist'),
  ('версатайл',        'versatile'),
  ('давслаг',          'salty'),
  ('өвслөг',           'herbal'),
  ('самарлаг',         'nutty'),
  ('халуун-ногоотой',  'hot-spicy'),
  ('цэцэглэг',         'floral'),
  ('орой',             'evening'),
  ('хөнгөн-тогтоцтой', 'light')
) as r(old_slug, new_slug)
where c.slug = r.old_slug;
