-- Каталог (anon) савны дүрмийг (`vial_inventory`) зөв бодох ёстой:
-- `perfume_vial_style`, `vial_for` хоёр anon-оор ажиллана.
--
-- 0149 үүнийг зөвхөн service role-д үлдээсэн (захиалгын RPC-ийн туслах гэж).
-- Гэтэл 0152-оос хойш `variant_sellable` (invoker) `vial_inventory` нээлттэй
-- үед үүнийг дууддаг — `catalog_search` anon-оор «permission denied for
-- function perfume_vial_style» өгч, каталог санах ойн удаан fallback руу
-- унадаг байв (cache-гүй, хүсэлт бүрт ~0.7с).
--
-- Эрх өгөхөд л хангалтгүй: функц `products`, `product_variants`-ийг шууд
-- уншдаг бөгөөд anon тэр хүснэгтүүдэд эрхгүй. Тиймээс security definer
-- (`vial_blocked_variants`, 0152-той ижил) — гаргах зүйл нь зөвхөн савны
-- өнгө («black» / «pink» / «silver» / null), нууц өгөгдөлгүй.

create or replace function perfume_vial_style(p_product uuid, p_ml int)
returns text
language sql stable security definer set search_path = public as $$
  select case when p_ml <= 2 then null else
    coalesce(
      (select pv.bottle_override_style from product_variants pv
        where pv.product_id = p_product and pv.ml = p_ml
          and pv.bottle_override and pv.bottle_override_style is not null),
      p.vial_style,
      default_vial_style(p.gender))
  end
  from products p where p.id = p_product;
$$;

revoke all on function perfume_vial_style(uuid, int) from public;
grant execute on function perfume_vial_style(uuid, int)
  to anon, authenticated, service_role;

-- `vial_for` нь `vials`-ийг шууд уншдаг — RLS («vials staff») anon-оос
-- мөрийг нуудаг тул null буцааж, `vial_available(null)` = false болж БҮХ
-- хэмжээ «Дууссан» харагддаг байв (сав 40+ ширхэгтэй үед ч). Буцаах нь
-- зөвхөн савны id — тоо, өртөг биш. Үлдэгдлийг `vial_available` (definer,
-- 0145) хариулна.
create or replace function vial_for(p_style text, p_ml int)
returns uuid
language sql stable security definer set search_path = public as $$
  select v.id from vials v
   where v.ml = p_ml
     and (case when p_ml <= 2 then v.style is null else v.style = p_style end);
$$;

revoke all on function vial_for(text, int) from public;
grant execute on function vial_for(text, int)
  to anon, authenticated, service_role;
