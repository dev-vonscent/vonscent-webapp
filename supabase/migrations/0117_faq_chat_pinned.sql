-- Чатын цонхны бэлэн асуулт (2026-10-08).
--
-- Сайтын баруун доод булангийн «Асуух зүйл байна уу?» цонх нээгдэхэд
-- хэрэглэгч бичихийн оронд бэлэн асуулт дээр дарж хариултаа шууд авна;
-- хариулт олдохгүй бол tawk.to-оор админтай холбогдоно. Асуултууд нь
-- FAQ-тай нэг эх сурвалж — админ «Контент → FAQ»-оос аль нь чатад
-- гарахыг тэмдэглэнэ.
--
-- Дээд тал нь 10 (`CHAT_FAQ_LIMIT`, src/lib/constants.ts): жижиг цонхонд
-- үүнээс олон бол гүйлгэх жагсаалт болж, «бэлэн асуулт»-ын утга алдагдана.
-- API нь урьдчилж шалгадаг ч зэрэг хоёр хүсэлт хоёулаа 9 гэж тоолоод 11
-- болгохоос энэ trigger сэргийлнэ.

alter table faqs
  add column if not exists chat_pinned boolean not null default false;

create or replace function faqs_chat_pinned_limit()
returns trigger
language plpgsql
as $$
begin
  if new.chat_pinned and (tg_op = 'INSERT' or not old.chat_pinned) then
    -- Хүснэгтийг түгжиж зэрэг бичилтийг дараалалд оруулна (FAQ ховор
    -- бичигддэг тул түгжээ мэдрэгдэхгүй).
    lock table faqs in share row exclusive mode;
    if (select count(*) from faqs where chat_pinned and id <> new.id) >= 10 then
      raise exception 'CHAT_FAQ_LIMIT' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists faqs_chat_pinned_limit on faqs;
create trigger faqs_chat_pinned_limit
  before insert or update of chat_pinned on faqs
  for each row execute function faqs_chat_pinned_limit();
