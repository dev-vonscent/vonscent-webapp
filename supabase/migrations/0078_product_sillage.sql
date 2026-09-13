-- Барааны ЭРЧИМ (sillage) — «үнэр чинь хэр хол мэдрэгдэх вэ».
--
-- Quiz-ийн сүүлийн асуулт (impression) эрчмийг асуудаг ч санд ийм багана
-- байгаагүй тул scorer нь концентрацаас ТААМАГЛАДАГ байв (EDT→сул, EDP→дундаж,
-- Parfum/Extrait/Elixir→хүчтэй). Бүх хариултын хослолыг шалгахад санал болгосон
-- барааны 50.2% нь сонгосон эрчимтэй зөрж байсан: Sauvage EDT олон Extrait-аас
-- хүчтэй, Afternoon Swim EDP нь зөөлөн — концентраци нь савны төрөл, хүч биш.
--
-- Тиймээс эрчмийг өөрийнх нь багана болгон админ гараар тохируулна. Утга:
--   light  — ойртоход л мэдрэгдэнэ (гар сунгах зай)
--   medium — хажуугаар зөрөхөд мэдрэгдэнэ (1–2 м)
--   strong — өрөөнд орж ирэхэд анзаарагдана
-- (`src/features/quiz/questions.ts`-ийн 6-р асуултын хариултуудтай нэг мөр.)

do $$ begin
  create type sillage_t as enum ('light','medium','strong');
exception when duplicate_object then null; end $$;

alter table products
  add column if not exists sillage sillage_t not null default 'medium';

comment on column products.sillage is
  'Үнэрийн хүч (quiz-ийн эрчмийн тэнхлэг). Админ гараар тохируулна.';

-- Урьдчилсан дүүргэлт: концентрацаар нь таамагласан хуучин дүрмээр дүүргэж,
-- админ зөвхөн ЗӨРҮҮТЭЙГ нь (Sauvage EDT = strong гэх мэт) засна. Шинэ бараа
-- анхдагчаар 'medium' — хамгийн саармаг таамаг.
update products
   set sillage = case concentration
                   when 'EDC' then 'light'
                   when 'EDT' then 'light'
                   when 'EDP' then 'medium'
                   else 'strong'
                 end::sillage_t;
