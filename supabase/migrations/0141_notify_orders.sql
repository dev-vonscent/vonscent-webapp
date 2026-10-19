-- Захиалгын төлөвийн мэдэгдэл (docs/planning/notifications-plan.md §4.3,
-- клиент баталсан 2026-10-18).
--
-- Зөвхөн хэрэглэгчийн хийх зүйл эсвэл хүлээлтийг өөрчилдөг milestone:
-- төлсөн → хүргэлтэд → хүргэгдсэн, мөн цуцлалт/буцаалт. Зочин
-- (`user_id is null`) — алгасна, тэдэнд имэйл хангалттай.
--
-- Нэг цэг: `orders` дээр AFTER UPDATE trigger — админ/курьер, cron
-- (`auto_dispatch_orders` / `auto_deliver_orders`), QPay `mark_order_paid`,
-- `mark_order_refunded` бүгд энд ирнэ. `order_status_history` дээр биш —
-- нэг шилжилтэд олон мөр бичигддэг.
--
-- Trigger-ийн НЭР `orders_user_notify`: Postgres нэг event-ийн trigger-үүдийг
-- нэрийн цагаан толгойн дарааллаар ажиллуулдаг. `orders_reward_coupon`-оос
-- хойш ажиллах ёстой — тэгж байж «купон нэмэгдлээ» мөрийг шалгаж чадна.
--
-- «Дараа захиалах» (автомат) нь trigger биш — `abandon_unpaid_order` дотор.

-- ── 1. Актор: хэрэглэгчийн ӨӨРИЙН цуцлалтыг мэдэгдэлгүй болгох ──────────
-- `update_order_status`-ийн бие нь dev сангийн одоогийн хувилбар (0112) —
-- зөвхөн `update orders`-ийн өмнө/хойно `set_config` нэмсэн. Транзакцын
-- түвшний (is_local) тохиргоо; дараа нь хоосолно — нэг transaction-д
-- дараагийн update руу хуучин актор дамжихгүй.
create or replace function update_order_status(
  p_order uuid,
  p_status order_status_t,
  p_note text,
  p_by uuid
)
returns void language plpgsql as $$
declare
  v_item record;
  v_prev order_status_t;
  v_paid boolean;
  v_need int;
begin
  select status, payment_status = 'paid'
    into v_prev, v_paid
    from orders where id = p_order for update;
  if not found then return; end if;

  -- Хүргэгдсэн бол цуцлагдахгүй тул оноог нь түгжээ дуусаагүй ч нээнэ.
  if p_status = 'delivered' and v_prev is distinct from 'delivered' then
    perform release_order_points(p_order);
  end if;

  -- Зөвхөн анх цуцлагдахад л урвуулна.
  if p_status = 'cancelled' and v_prev is distinct from 'cancelled' then
    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
      if v_item.product_id is not null then
        if v_paid then
          -- Төлсөн захиалга on_hand-аас commit хийгдсэн — ml-ийг буцаана.
          update inventory
            set on_hand_ml = on_hand_ml + v_item.ml * v_item.qty
            where product_id = v_item.product_id;
          update inventory
            set is_sold_out = false
            where product_id = v_item.product_id and (on_hand_ml - reserved_ml) > 0;
        else
          perform release_inventory(v_item.product_id, v_item.ml * v_item.qty);
        end if;
      end if;
    end loop;

    perform reverse_order_loyalty(p_order);
  end if;

  -- Сэргээлт (super_admin, cancelled → идэвхтэй төлөв): цуцлалт ml-ийг
  -- буцаасан тул энэ захиалгад дахин барина. Төлсөн бол шууд хасна
  -- (reserve → commit), төлөөгүй бол reserve. Хүрэхгүй бол бүхэлд нь
  -- татгалзана — эс бөгөөс дараагийн commit бусдын reserve-ийг иднэ.
  --
  -- Анхаар: цуцлалтаар урвуулсан оноо, купон сэргэхгүй.
  if v_prev = 'cancelled' and p_status <> 'cancelled' then
    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
      if v_item.product_id is not null then
        v_need := v_item.ml * v_item.qty;
        if not reserve_inventory(v_item.product_id, v_need) then
          raise exception 'INSUFFICIENT_STOCK:%', v_item.product_id
            using errcode = 'check_violation';
        end if;
        if v_paid then
          perform commit_inventory(v_item.product_id, v_need);
        end if;
      end if;
    end loop;
  end if;

  perform set_config('vonscent.order_actor', coalesce(p_by::text, ''), true);  -- 0141
  update orders set status = p_status,
    reserve_expires_at = case when p_status in ('cancelled') then null else reserve_expires_at end
    where id = p_order;
  perform set_config('vonscent.order_actor', '', true);  -- 0141

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, p_status, coalesce(p_note,''), p_by);
end $$;

-- ── 2. Trigger ─────────────────────────────────────────────────────────
create or replace function orders_user_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_url text;
  v_body text;
begin
  if new.user_id is null then
    return new;
  end if;
  -- `notify_user` өөрөө шалгадаг ч энд эрт гарвал купоны хайлт ч хийгдэхгүй.
  if not feature_enabled('notifications') then
    return new;
  end if;
  v_url := '/account/orders/' || new.id;

  -- Төлбөр баталгаажлаа (QPay эсвэл админ гараар).
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    v_body := case when new.deliver_on is not null
      then to_char(new.deliver_on, 'MM/DD') || '-нд хүргэнэ.' end;
    if exists (select 1 from coupons where source_order_id = new.id) then
      v_body := concat_ws(' ', v_body, 'Дараагийн захиалгад тань купон нэмэгдлээ.');
    end if;
    perform notify_user(
      new.user_id, 'order_paid',
      new.order_no || ' захиалгын төлбөр баталгаажлаа',
      v_body, v_url,
      jsonb_build_object('orderId', new.id),
      'order:' || new.id || ':order_paid'
    );
  end if;

  -- Хүргэлтэд гарлаа. Зөвхөн урагш шилжилт — админ `shipping` → `confirmed`
  -- засаад буцаахад мэдэгдэлгүй; dedupe нь дахин гаргахгүй.
  if new.status = 'shipping' and old.status in ('pending', 'confirmed') then
    perform notify_user(
      new.user_id, 'order_shipping',
      new.order_no || ' захиалга тань өнөөдөр хүргэлтэд гарлаа',
      'Утсаа ойрхон байлгаарай.', v_url,
      jsonb_build_object('orderId', new.id),
      'order:' || new.id || ':order_shipping'
    );
  end if;

  -- Хүргэгдлээ. 23:00-ийн авто шилжилт курьерын баталгаагүй тул зөөлөн
  -- текст (клиент баталсан). Оноо нээгдсэн нь тусдаа мэдэгдэл (0139).
  if new.status = 'delivered' and old.status in ('pending', 'confirmed', 'shipping') then
    perform notify_user(
      new.user_id, 'order_delivered',
      new.order_no || ' захиалга хүргэгдсэн гэж бүртгэгдлээ',
      'Хүлээж аваагүй бол бидэнтэй холбогдоорой.', v_url,
      jsonb_build_object('orderId', new.id),
      'order:' || new.id || ':order_delivered'
    );
  end if;

  -- Цуцлагдлаа — зөвхөн төлсөн, бусдын (админ) цуцалсан. Хэрэглэгч өөрөө
  -- цуцалбал имэйл аль хэдийн явдаг. Төлөөгүй цуцлалт (хугацаа дууссан) —
  -- «Дараа захиалах» мэдэгдэл тусдаа. Хугацаа амлахгүй.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.payment_status = 'paid' then
    v_actor := nullif(current_setting('vonscent.order_actor', true), '')::uuid;
    if v_actor is distinct from new.user_id then
      perform notify_user(
        new.user_id, 'order_cancelled',
        new.order_no || ' захиалга цуцлагдлаа',
        'Төлбөрийн буцаалтын талаар бид тантай холбогдоно.', v_url,
        jsonb_build_object('orderId', new.id),
        'order:' || new.id || ':order_cancelled'
      );
    end if;
  end if;

  -- Мөнгө буцаан олгогдлоо. Дүн = `refund_amount` (0114) — дахин тооцохгүй.
  if new.payment_status = 'refunded' and old.payment_status is distinct from 'refunded' then
    perform notify_user(
      new.user_id, 'order_refunded',
      new.order_no || ' захиалгын ' ||
        case when new.refund_amount is not null
          then to_char(new.refund_amount, 'FM999,999,999') || '₮ '
          else 'төлбөр ' end ||
        'буцаан олгогдлоо',
      null, v_url,
      jsonb_build_object('orderId', new.id, 'amount', new.refund_amount),
      'order:' || new.id || ':order_refunded'
    );
  end if;

  return new;
end $$;

drop trigger if exists orders_user_notify on orders;
create trigger orders_user_notify
  after update of status, payment_status on orders
  for each row execute function orders_user_notify();

-- ── 3. «Дараа захиалах» (автомат) ──────────────────────────────────────
-- 0124-ийн бие + мэдэгдэл. Зөвхөн систем шилжүүлсэн үед (`p_by is null`:
-- `release_expired_reserves` cron ба account хуудасны `settle-expired`) —
-- хэрэглэгч өөрөө товч дарвал (`p_by = owner`) мэдэгдэлгүй. Хуулбар
-- аль хэдийн байсан (давхар дуудлага) бол `save_order_for_later` null.
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
  v_saved uuid;     -- 0141
  v_user uuid;      -- 0141
begin
  select status, payment_status, user_id into v_status, v_payment, v_user
    from orders where id = p_order for update;
  if v_status is distinct from 'pending' or v_payment is distinct from 'unpaid' then
    return false;
  end if;
  -- Хуулбар нь цуцлалтаас ӨМНӨ: цуцлагдах мөчид trigger түүнийг арилгана.
  if p_save then
    v_saved := save_order_for_later(p_order);
  end if;
  perform update_order_status(p_order, 'cancelled', p_note, p_by);

  -- 0141: мэдэгдэл
  if p_save and p_by is null and v_saved is not null then
    perform notify_user(
      v_user, 'order_saved',
      'Төлөгдөөгүй захиалгаа «Дараа захиалах»-д хадгаллаа',
      'Хүссэн үедээ нэг товчоор үргэлжлүүлээрэй.',
      '/account/orders?tab=saved',
      jsonb_build_object('orderId', p_order, 'savedId', v_saved),
      'order:' || p_order || ':order_saved'
    );
  end if;
  return true;
end $$;

revoke all on function orders_user_notify() from public, anon, authenticated;
