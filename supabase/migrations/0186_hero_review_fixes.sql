-- S1–S4 review-ийн засвар (docs/campaigns/studio-ux.md §14 S4).
--
-- 1. `season_hero_at` нь `public`-ээс л хаагдсан байсан — Supabase-ийн default
--    privileges-ээр anon/authenticated EXECUTE авч, туг хаалттай үед ч
--    PostgREST-ээр дуудагдах боломжтой байв (dev дээр баталсан). Бусад
--    service_role-only функцтэй (0181, 0184) ижил болгоно. 0185-ийн файл ч
--    засагдсан; энэ нь аль хэдийн 0185 ажилласан санд (dev) зориулсан.
--
-- 2. Арга хэмжээ бүрт ганц баннер (D6). Студиэс гарах мөчид давхар POST явж
--    хоёр мөр үүсэх race байсан (клиентэд засагдсан) — сан дээр ч хаана.
--
-- Expand only: эрх хасах, partial unique index. Хуучин код нэг арга хэмжээнд
-- нэг л мөр бичдэг. Index үүсэхээс өмнө давхардлыг шалгаж, байвал тодорхой
-- алдаагаар зогсоно (өгөгдлийг автоматаар устгахгүй).

revoke all on function season_hero_at(timestamptz) from public, anon, authenticated;
grant execute on function season_hero_at(timestamptz) to service_role;

do $$
begin
  if exists (
    select 1 from heroes
     where sale_event_id is not null
     group by sale_event_id
    having count(*) > 1
  ) then
    raise exception
      'heroes: нэг арга хэмжээнд хэд хэдэн баннер байна — эхлээд гараар цэвэрлэ '
      '(select sale_event_id, array_agg(id) from heroes where sale_event_id is not null group by 1 having count(*) > 1)';
  end if;
end $$;

create unique index if not exists heroes_sale_event_uniq
  on heroes (sale_event_id)
  where sale_event_id is not null;

comment on index heroes_sale_event_uniq is
  'Арга хэмжээ бүрт ганц баннер (studio-ux.md D6, 0186).';
