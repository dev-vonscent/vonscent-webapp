-- Азын хүрд → feature flag (0133). `LUCKY_WHEEL_HIDDEN` const-ийг орлоно:
-- тэр нь кодонд байсан тул dev/main хоёулаа ижил утгатай, release бүрийн өмнө
-- гараар солих ёстой байв (RELEASE_CHECKLIST §0).
--
-- Анхдагч `false` — prod-д хаалттай. dev-д клиентийн туршилтад зориулж
-- админаас (Feature flag) асаана.
insert into feature_flags (key) values ('lucky_wheel') on conflict do nothing;

-- Гурав дахь давхарга: туг хаалттай үед төлөгдсөн захиалга эрх ҮҮСГЭХГҮЙ.
-- Өмнө нь зөвхөн `settings.spin.orderSpinStep = 0`-оор (0130) хаадаг байсан
-- бөгөөд админ алхмыг буцааж тавимагц хүрд нуугдсан хэвээр эрх хуримтлагдаж
-- эхэлдэг байв.
--
-- `spin_wheel` / `spin_wheel_state`-д нэмэх шаардлагагүй: зөвхөн service_role
-- дуудна (0129), тэр нь `/api/lucky-wheel` дотор тугаар хаагдсан.
-- `settings.spin.enabled` нь хэвээр — нээлттэй feature-ийн ажиллагааны
-- унтраалга (ж: шагнал дууссан үед түр зогсоох).
create or replace function orders_grant_spins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not feature_enabled('lucky_wheel') then return new; end if;
  perform grant_order_spins(new.id);
  return new;
end $$;
