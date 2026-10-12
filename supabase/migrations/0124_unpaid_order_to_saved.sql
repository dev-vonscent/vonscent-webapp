-- 0124 — Төлөгдөөгүй захиалга «Дараа захиалах» руу (клиент, 2026-10)
--
-- Төлбөрийн хуудсан дээр:
--   • 30 минутад төлөгдөөгүй захиалга автоматаар «Дараа захиалах»
--     (`saved_checkouts`, 0116) руу шилжинэ;
--   • хэрэглэгч «Дараа захиалах» товчоор өөрөө шилжүүлж, «Устгах»
--     товчоор устгаж болно.
-- Аль ч тохиолдолд захиалга `cancelled` болж нөөцөө суллана — гэхдээ
-- админд энэ нь цуцлалт биш: мөнгө огт ороогүй тул хийх ажил алга.
-- Админы жагсаалтад цуцлагдсан нь зөвхөн ТӨЛСӨН захиалга (хэрэглэгч
-- 00:00-оос өмнө цуцалсан) байна.
--
-- `saved_checkouts`-ийн мөр нь сагсны мөрийн хуулбар (slug, зураг, багцын
-- гишүүд) — `order_items`-аас сэргээж болдоггүй. Тиймээс checkout захиалга
-- илгээхдээ тэр хуулбарыг дагуулж ирүүлнэ (`checkout_snapshot`), зөвхөн
-- бүртгэлтэй хэрэглэгчид (сервер `savedCheckoutInputSchema`-аар шалгана).

alter table orders add column if not exists checkout_snapshot jsonb;

-- Нэг захиалга «Дараа захиалах» руу нэг л удаа: товч ба cron зэрэг
-- ажилласан ч давхар мөр үүсэхгүй.
alter table saved_checkouts
  add column if not exists source_order_id uuid
    references orders(id) on delete set null;
create unique index if not exists saved_checkouts_source_order_uidx
  on saved_checkouts (source_order_id) where source_order_id is not null;

-- Захиалгын хуулбарыг `saved_checkouts` руу. Хуулбаргүй (зочин, хуучин
-- захиалга) бол юу ч хийхгүй — null буцаана. Хэрэглэгч бүрд 10-аас
-- хэтэрвэл хуучныг нь хасна (SAVED_CHECKOUTS_MAX, API-тай ижил).
create or replace function save_order_for_later(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_snap jsonb;
  v_id uuid;
begin
  select user_id, checkout_snapshot into v_user, v_snap
    from orders where id = p_order;
  if v_user is null or v_snap is null then
    return null;
  end if;

  insert into saved_checkouts (user_id, buy_now, items, collections, draft, source_order_id)
  values (
    v_user,
    coalesce((v_snap->>'buyNow')::boolean, false),
    coalesce(v_snap->'items', '[]'::jsonb),
    coalesce(v_snap->'collections', '[]'::jsonb),
    coalesce(v_snap->'draft', '{}'::jsonb),
    p_order
  )
  on conflict (source_order_id) where source_order_id is not null do nothing
  returning id into v_id;

  delete from saved_checkouts s
   where s.user_id = v_user
     and s.id in (
       select id from saved_checkouts
        where user_id = v_user
        order by created_at desc
        offset 10
     );

  return v_id;
end $$;

-- Төлөгдөөгүй захиалгыг орхих: (хүсвэл) «Дараа захиалах» руу хуулж, дараа
-- нь цуцална — нэг transaction, нэг row lock дотор. Төлбөрийн хуудасны
-- хоёр товч ба cron гурвуулаа үүгээр явна. Төлбөр орчихсон (эсвэл аль
-- хэдийн цуцлагдсан) бол юу ч хийхгүй — false.
create or replace function abandon_unpaid_order(
  p_order uuid,
  p_save boolean,
  p_note text,
  p_by uuid default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_status order_status_t;
  v_payment payment_status_t;
begin
  select status, payment_status into v_status, v_payment
    from orders where id = p_order for update;
  if v_status is distinct from 'pending' or v_payment is distinct from 'unpaid' then
    return false;
  end if;
  -- Хуулбар нь цуцлалтаас ӨМНӨ: цуцлагдах мөчид trigger түүнийг арилгана.
  if p_save then
    perform save_order_for_later(p_order);
  end if;
  perform update_order_status(p_order, 'cancelled', p_note, p_by);
  return true;
end $$;

-- 0019-ийн бие; цуцлалт нь `abandon_unpaid_order`-оор — хуулбартай бол
-- «Дараа захиалах» руу шилжинэ.
create or replace function release_expired_reserves()
returns int language plpgsql as $$
declare
  v_order record;
  n int := 0;
begin
  for v_order in
    select id from orders
    where status = 'pending'
      and payment_status = 'unpaid'
      and reserve_expires_at is not null
      and reserve_expires_at < now()
    for update skip locked
  loop
    if abandon_unpaid_order(v_order.id, true, 'Захиалгын хугацаа дууссан') then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Хуулбар нь зөвхөн төлөгдөөгүй захиалгад хэрэгтэй. Төлөгдсөн эсвэл
-- цуцлагдсан мөчид арилгана — `orders`-ийг `select *`-ээр уншдаг газрууд
-- (админы жагсаалт) 64KB хүртэлх JSON-ыг мөр бүрээр зөөхгүй.
create or replace function orders_clear_snapshot()
returns trigger language plpgsql as $$
begin
  if new.checkout_snapshot is not null
     and (new.payment_status <> 'unpaid' or new.status <> 'pending') then
    new.checkout_snapshot := null;
  end if;
  return new;
end $$;

drop trigger if exists orders_clear_snapshot on orders;
create trigger orders_clear_snapshot
  before update on orders
  for each row execute function orders_clear_snapshot();

-- 0113-ын бие; мэдэгдэл нь зөвхөн мөнгө орсон захиалгад.
create or replace function orders_on_cancelled()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if new.payment_status <> 'unpaid' then
      insert into admin_notifications (kind, order_id, message)
      values (
        'order_cancelled',
        new.id,
        'Захиалга ' || new.order_no || ' цуцлагдлаа — ' ||
        coalesce(new.contact_name, '') || ' (' || coalesce(new.contact_phone, '') || '). ' ||
        case when new.payment_status = 'paid'
          then 'Төлбөр төлөгдсөн тул хэрэглэгчтэй холбогдож мөнгийг нь буцаана уу.'
          else 'Төлбөр төлөгдөөгүй байсан.' end
      );
    end if;

    perform release_order_coupons(new.id);
    perform revoke_order_reward_coupon(new.id);
  end if;
  return new;
end $$;

-- 0088-ын дүрэм: захиалгыг хөдөлгөдөг функц зөвхөн service_role-д.
revoke all on function save_order_for_later(uuid) from public, anon, authenticated;
grant execute on function save_order_for_later(uuid) to service_role;
revoke all on function abandon_unpaid_order(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function abandon_unpaid_order(uuid, boolean, text, uuid) to service_role;
revoke all on function release_expired_reserves() from public, anon, authenticated;
grant execute on function release_expired_reserves() to service_role;
