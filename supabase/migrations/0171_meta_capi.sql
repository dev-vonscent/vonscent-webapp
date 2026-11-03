-- Meta Conversions API (CAPI) — Purchase-ийг серверээс (docs/planning/meta-pixel-plan.md §5, 2-р шат).
--
-- Browser pixel-ийн Purchase алдагддаг: банкны аппаар төлөөд сайт руу
-- буцаагүй, ad blocker, дансаар шилжүүлснийг админ гараар баталсан г.м.
-- Сервер `mark_order_paid`-ийн дараа Meta руу шууд илгээнэ. Meta тэр event-ийг
-- browser-ынхтой тааруулахын тулд захиалга үүсэх мөчийн `_fbp`/`_fbc` cookie,
-- IP, user agent хэрэгтэй — тэдгээрийг энд хадгална.
--
-- Expand only: зөвхөн nullable багана. `place_order`-ийн signature
-- хөндөгдөхгүй — `api/orders` захиалга үүссэний дараа тусдаа update-ээр
-- бичнэ, ЗӨВХӨН `meta_capi` туг асаалттай үед. Туг хаалттай prod дээр эдгээр
-- багана null хэвээр үлдэнэ.

alter table orders
  add column if not exists meta_fbp text,
  add column if not exists meta_fbc text,
  add column if not exists client_ip inet,
  add column if not exists client_user_agent text;

comment on column orders.meta_fbp is
  'Meta `_fbp` cookie захиалга үүсэх мөчид (meta_capi туг асаалттай үед л). CAPI Purchase-ийн user_data.fbp.';
comment on column orders.meta_fbc is
  'Meta `_fbc` cookie (зарын click id) захиалга үүсэх мөчид (meta_capi туг асаалттай үед л).';
comment on column orders.client_ip is
  'Захиалагчийн IP (x-forwarded-for-ийн эхнийх) — CAPI user_data.client_ip_address. meta_capi туг асаалттай үед л.';
comment on column orders.client_user_agent is
  'Захиалагчийн user agent — CAPI user_data.client_user_agent. meta_capi туг асаалттай үед л.';

insert into feature_flags (key) values ('meta_capi') on conflict do nothing;
