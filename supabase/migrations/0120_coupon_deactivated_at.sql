-- «Миний купон»: дууссан/ашигласан купоныг 30 хоногийн дараа жагсаалтаас
-- нуух (сангаас устгахгүй — админы log, тайланд хэрэгтэй).
--
-- Хугацаа нь өнгөрсөн купонд эхлэх огноо нь `ends_at`, ашигласанд нь сүүлчийн
-- ашиглалт. Харин УНТРААСАН купонд (админ унтраасан, хүрдний шинэ купон
-- хуучныг орлосон, захиалга цуцлагдаж урамшуулал хүчингүй болсон) хэзээ
-- унтарсан нь хадгалагддаггүй байв. Энэ багана түүнийг тэмдэглэнэ.

alter table coupons add column if not exists deactivated_at timestamptz;

create or replace function coupons_track_deactivation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    -- Унтраалттай үүссэн купон (ховор) — үүссэн мөчөөс тоолно.
    new.deactivated_at := case when new.is_active then null else now() end;
  elsif new.is_active is distinct from old.is_active then
    new.deactivated_at := case when new.is_active then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists coupons_track_deactivation on coupons;
create trigger coupons_track_deactivation
  before insert or update of is_active on coupons
  for each row execute function coupons_track_deactivation();

-- Одоо унтраалттай байгаа купонууд хэзээ унтарсан нь тодорхойгүй — өнөөдрөөр
-- тэмдэглэнэ. Ингэснээр тэд гэнэт алга болохгүй, 30 хоног харагдсаар байна.
update coupons set deactivated_at = now()
  where not is_active and deactivated_at is null;
