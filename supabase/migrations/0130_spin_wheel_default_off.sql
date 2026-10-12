-- Азын хүрд v2-ийг (0129) анхдагчаар УНТРААНА.
--
-- 0129 нь `orders_spin_credits` trigger нэмдэг бөгөөд тэр нь `LUCKY_WHEEL_HIDDEN`
-- ба `spin.enabled`-ийн алийг нь ч шалгалгүй төлөгдсөн захиалга бүрт эрх
-- олгодог (`grant_order_spins`), эрхийн хугацаа дуусдаггүй. Хүрд нуугдсан
-- үед ч prod дээр эрх хуримтлагдаж, нээх өдөр «бэлэн эрх» болох байв.
-- Мөн `POST /api/lucky-wheel` нь UI-ийн тугийг шалгадаггүй тул шууд
-- дуудахад эргэнэ.
--
--   enabled = false    → `spin_wheel` нь DISABLED (API шууд дуудсан ч)
--   orderSpinStep = 0  → `grant_order_spins` эрх олгохгүй
--
-- Нээх: Админ → Азын хүрд → «Идэвхтэй» асааж, захиалгын алхмыг (100,000)
-- буцааж тавина. Сан бүрт тусдаа тул dev дээр туршихын тулд dev-ийн админаас
-- асаана — prod-д нөлөөгүй.
update settings
   set value = value || jsonb_build_object('enabled', false, 'orderSpinStep', 0)
 where key = 'spin';
