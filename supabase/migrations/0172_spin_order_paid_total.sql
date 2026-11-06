-- Азын хүрд: захиалгын эрхийг ТӨЛСӨН дүнгээс бодно (хүргэлттэй).
--
-- 0129-д суурь = барааны дүн − купон (хүргэлтгүй) байсан тул 95,000₮-ийн
-- бараа + 7,000₮ хүргэлт = 102,000₮ төлсөн харилцагч эрх авахгүй байв —
-- «Төлөгдсөн захиалгын 100,000₮ тутамд» гэсэн тайлбартай зөрсөн.
--
-- Шинэ суурь = барааны дүн + хүргэлт − купон (= `total + loyalty_used`).
-- V point-оор төлсөн хэсэг төлбөрт тооцогдсон хэвээр (дүрмийн «V point
-- ашигласан байж болно» хэвээр).
--
-- Зөвхөн функцийн бие солигдоно (expand only) — trigger, хүснэгт, туг
-- (`lucky_wheel`, 0134) хэвээр. Өмнө нь олгосон эрхийг дахин бодохгүй.

create or replace function grant_order_spins(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_base int;
  v_step int;
  v_spins int;
begin
  select user_id,
         greatest(coalesce(subtotal, 0) + coalesce(shipping_fee, 0)
                  - coalesce(discount, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return 0; end if;   -- зочин хүрд эргүүлэхгүй

  select coalesce((value->>'orderSpinStep')::int, 100000) into v_step
    from settings where key = 'spin';
  v_step := coalesce(v_step, 100000);
  if v_step <= 0 then return 0; end if;

  v_spins := v_base / v_step;
  if v_spins <= 0 then return 0; end if;

  insert into spin_wheel_credits (order_id, user_id, spins, base)
    values (p_order, v_user, v_spins, v_base)
    on conflict (order_id) do nothing;
  return v_spins;
end $$;

-- `create or replace` эрхийг анхдагч руу буцаадаг — 0129-ийн түгжээг давтана.
revoke all on function grant_order_spins(uuid) from public, anon, authenticated;
