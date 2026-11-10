-- Бэлгийн дээжийн 1ml сав бэлэн үү — `/api/gifts` (public client).
-- Feature flag: `vial_inventory` (хаалттай бол үргэлж true — хуучин зан).
--
-- Алдаа: route нь `vial_for(null, 1)`-ийг anon-оор дууддаг байв. `vial_for`
-- (0145) security definer БИШ, `vials` RLS-тэй, anon-д policy алга → үргэлж
-- null → «1ml сав алга» → туг нээлттэй үед бэлэг сонгох хэсэг ХЭЗЭЭ Ч
-- гарахгүй байв. `vial_for`-ийг definer болгохгүй: каталогийн
-- `variant_sellable` мөр бүрт дууддаг, definer нь SQL inline-ийг унтраана.
-- Оронд нь зөвхөн boolean буцаах нарийн функц.

create or replace function gift_vial_available()
returns boolean language sql stable security definer set search_path = public as $$
  select not feature_enabled('vial_inventory')
      or vial_available(vial_for(null, 1));
$$;

comment on function gift_vial_available() is
  'Бэлгийн 1ml сав нээлттэй, үлдэгдэлтэй эсэх (vial_inventory хаалттай бол true).';

revoke all on function gift_vial_available() from public;
grant execute on function gift_vial_available() to anon, authenticated, service_role;
