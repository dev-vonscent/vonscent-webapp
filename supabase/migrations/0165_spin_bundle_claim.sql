-- Азын хүрдний гранд шагнал (2мл багц): хожих → сонгох → дараагийн захиалгад
-- үнэгүй авах (feature flag `lucky_wheel`).
--
-- Өмнө нь `bundle` эргэлт зөвхөн `spin_wheel_spins`-д мөр бичээд үлддэг байв:
-- аль багц, хэзээ, аль захиалгаар — юу ч холбогдоогүй, админ «Хүргэсэн» гэж
-- гараар тэмдэглэдэг. Одоо:
--
--   1. Хожих: `expires_at` = хожсон + `settings.spin.bundleClaimDays` (60).
--      Хэрэглэгч ба админд мэдэгдэл.
--   2. Сонгох: админы сонгосон 2 багцаас (`settings.spin.grandBundles`
--      {male, female}) нэгийг — `bundle_collection_id`, `bundle_gender`
--      (route бичнэ, багц 2мл-ээр бэлэн эсэхийг шалгаад).
--   3. Авах: `place_order_with_prize` — захиалгатай НЭГ transaction-д багцын
--      гишүүн бүрийг 2мл, 0₮ бэлгийн мөрөөр нэмж нөөцийг reserve хийнэ;
--      `claim_order_id`. Нөөц хүрэхгүй бол захиалга бүхэлдээ буцна.
--   4. Захиалга хүргэгдвэл `fulfilled_at`; цуцлагдвал/буцаагдвал шагнал
--      буцаж «авах боломжтой», хугацаа нь дор хаяж 14 хоног үлдэнэ.
--   5. Дуусахаас 7 хоногийн өмнө сануулга (pg_cron).
--
-- Нөөц нь `order_items`-ийг дагадаг (commit: mark_order_paid, release:
-- update_order_status) тул шагналын мөрүүд нэмэлт кодгүйгээр зөв тооцогдоно.
--
-- Expand only: nullable баганууд, шинэ функц/trigger — хуучин код эдгээрийг
-- мэдэхгүй хэвээр ажиллана.

alter table spin_wheel_spins
  add column if not exists bundle_collection_id uuid
    references collections(id) on delete set null,
  add column if not exists bundle_gender text
    check (bundle_gender in ('male', 'female')),
  add column if not exists chosen_at timestamptz,
  add column if not exists claim_order_id uuid
    references orders(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists spin_wheel_spins_claim_order_idx
  on spin_wheel_spins (claim_order_id) where claim_order_id is not null;

-- Захиалгын мөр аль шагналаас ирснийг — админы бэлтгэл, Telegram, тайлан.
alter table order_items
  add column if not exists spin_id uuid
    references spin_wheel_spins(id) on delete set null;

update settings
   set value = value
     || jsonb_build_object(
          'grandBundles', jsonb_build_object('male', null, 'female', null),
          'bundleClaimDays', 60)
 where key = 'spin' and not (value ? 'bundleClaimDays');

-- Өмнө хожоод хүргэгдээгүй шагналууд: шударга байх үүднээс одооноос
-- дор хаяж 60 хоног.
update spin_wheel_spins
   set expires_at = greatest(created_at, now()) + interval '60 days'
 where kind = 'bundle' and fulfilled_at is null and expires_at is null;

------------------------------------------------------------------------------
-- 1. Хожих: хугацаа + мэдэгдэл
------------------------------------------------------------------------------

create or replace function spin_wheel_spins_bundle_expiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_days int;
begin
  if new.kind = 'bundle' and new.expires_at is null then
    select coalesce((value->>'bundleClaimDays')::int, 60) into v_days
      from settings where key = 'spin';
    new.expires_at := coalesce(new.created_at, now())
      + make_interval(days => greatest(coalesce(v_days, 60), 1));
  end if;
  return new;
end $$;

drop trigger if exists spin_wheel_spins_bundle_expiry on spin_wheel_spins;
create trigger spin_wheel_spins_bundle_expiry
  before insert on spin_wheel_spins
  for each row execute function spin_wheel_spins_bundle_expiry();

create or replace function spin_wheel_spins_bundle_won()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_phone text;
begin
  if new.kind <> 'bundle' then
    return new;
  end if;

  perform notify_user(
    new.user_id,
    'prize_won',
    'Та гранд шагнал хожлоо!',
    'Эрэгтэй эсвэл эмэгтэй 2мл багцаа сонгоод дараагийн захиалгадаа үнэгүй аваарай.',
    '/lucky-wheel#prizes',
    jsonb_build_object('spinId', new.id),
    'prize_won:' || new.id,
    now()
  );

  select full_name, phone into v_name, v_phone
    from profiles where id = new.user_id;
  insert into admin_notifications (kind, message)
    values ('spin_grand', format(
      'Азын хүрд: %s (%s) гранд шагнал «%s» хожлоо',
      coalesce(nullif(btrim(v_name), ''), 'Хэрэглэгч'),
      coalesce(v_phone, '—'),
      new.label));
  return new;
end $$;

drop trigger if exists spin_wheel_spins_bundle_won on spin_wheel_spins;
create trigger spin_wheel_spins_bundle_won
  after insert on spin_wheel_spins
  for each row execute function spin_wheel_spins_bundle_won();

------------------------------------------------------------------------------
-- 3. Авах: захиалга + шагнал нэг transaction-д
------------------------------------------------------------------------------

/**
 * `place_order`-ийг дуудаад, `p_spin` өгсөн бол тэр шагналын багцыг ижил
 * transaction-д захиалгад хавсаргана. Шагнал авах боломжгүй (эзэн биш,
 * сонгоогүй, авсан, хугацаа дууссан) эсвэл гишүүний 2мл нөөц/сав хүрэхгүй бол
 * `PRIZE_UNAVAILABLE` — захиалга ч үүсэхгүй, route шагналгүйгээр дахин санал
 * болгоно.
 */
create or replace function place_order_with_prize(
  p_order jsonb,
  p_items jsonb,
  p_spin uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
  v_order uuid;
  v_user uuid := nullif(p_order->>'user_id', '')::uuid;
  v_spin spin_wheel_spins;
  v_coll_name text;
  v_item record;
  v_variant uuid;
  v_override boolean;
  v_lines int := 0;
begin
  v_res := place_order(p_order, p_items);
  if p_spin is null then
    return v_res;
  end if;

  if v_user is null or not feature_enabled('lucky_wheel') then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  v_order := (v_res->>'order_id')::uuid;

  -- Нэг шагналыг зэрэг хоёр захиалгад авахаас хамгаална.
  select * into v_spin from spin_wheel_spins where id = p_spin for update;
  if not found
     or v_spin.user_id is distinct from v_user
     or v_spin.kind <> 'bundle'
     or v_spin.bundle_collection_id is null
     or v_spin.claim_order_id is not null
     or v_spin.fulfilled_at is not null
     or (v_spin.expires_at is not null and v_spin.expires_at < now()) then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  select name into v_coll_name
    from collections where id = v_spin.bundle_collection_id;

  for v_item in
    select ci.product_id, p.name, p.brand, p.gender, p.status
      from collection_items ci
      join products p on p.id = ci.product_id
     where ci.collection_id = v_spin.bundle_collection_id
     order by ci.sort_order
  loop
    if v_item.status <> 'active' then
      raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
    end if;

    select pv.id, coalesce(pv.bottle_override, false)
      into v_variant, v_override
      from product_variants pv
     where pv.product_id = v_item.product_id and pv.ml = 2 and pv.is_active
     for share;
    if not found then
      raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
    end if;

    -- place_order-ийн адил савны түгжээ (0095).
    if v_item.gender is not null
       and not (bottle_active(v_item.gender, 2) or v_override) then
      raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
    end if;

    if not reserve_inventory(v_item.product_id, 2) then
      raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
    end if;

    insert into order_items (
      order_id, product_id, variant_id, product_name, brand,
      ml, unit_price, list_price, qty, is_sample, line_total,
      collection_id, collection_name, is_gift, spin_id
    ) values (
      v_order, v_item.product_id, v_variant, coalesce(v_item.name, ''),
      coalesce(v_item.brand, ''),
      2, 0, 0, 1, false, 0,
      v_spin.bundle_collection_id,
      'Азын хүрдний шагнал · ' || coalesce(v_coll_name, ''),
      true, v_spin.id
    );
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  update spin_wheel_spins
     set claim_order_id = v_order, claimed_at = now()
   where id = v_spin.id;

  insert into order_status_history (order_id, status, note, changed_by)
    select v_order, o.status,
           'Азын хүрдний гранд шагнал хавсаргав: ' || coalesce(v_coll_name, ''),
           v_user
      from orders o where o.id = v_order;

  return v_res || jsonb_build_object('prize_spin_id', v_spin.id);
end $$;

revoke all on function place_order_with_prize(jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function place_order_with_prize(jsonb, jsonb, uuid)
  to service_role;

------------------------------------------------------------------------------
-- 4. Захиалгын төлөвтэй уялдуулах
------------------------------------------------------------------------------

create or replace function orders_spin_prize_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update spin_wheel_spins
       set fulfilled_at = now()
     where claim_order_id = new.id and fulfilled_at is null;
  elsif (new.status = 'cancelled' and old.status is distinct from 'cancelled')
     or (new.payment_status = 'refunded'
         and old.payment_status is distinct from 'refunded') then
    -- Шагнал буцаж «авах боломжтой» — хэрэглэгчийн буруугүй цуцлалтаар
    -- (нөөц дуусах, төлбөрийн хугацаа) шагналаа алдах ёсгүй.
    update spin_wheel_spins
       set claim_order_id = null,
           claimed_at = null,
           expires_at = greatest(coalesce(expires_at, now()),
                                 now() + interval '14 days')
     where claim_order_id = new.id and fulfilled_at is null;
  end if;
  return new;
end $$;

drop trigger if exists orders_spin_prize_sync on orders;
create trigger orders_spin_prize_sync
  after update of status, payment_status on orders
  for each row execute function orders_spin_prize_sync();

------------------------------------------------------------------------------
-- 5. Сануулга: дуусахаас 7 хоногийн өмнө, нэг удаа
------------------------------------------------------------------------------

create or replace function remind_spin_prizes()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not feature_enabled('lucky_wheel') then
    return;
  end if;
  for r in
    select id, user_id, expires_at
      from spin_wheel_spins
     where kind = 'bundle'
       and claim_order_id is null
       and fulfilled_at is null
       and expires_at > now()
       and expires_at <= now() + interval '7 days'
  loop
    perform notify_user(
      r.user_id,
      'prize_won',
      'Гранд шагналын хугацаа дуусах гэж байна',
      format('2мл багцаа %s хүртэл захиалгадаа үнэгүй аваарай.',
             to_char(r.expires_at at time zone 'Asia/Ulaanbaatar', 'YYYY.MM.DD')),
      '/lucky-wheel#prizes',
      jsonb_build_object('spinId', r.id),
      'prize_remind:' || r.id,
      now()
    );
  end loop;
end $$;

revoke all on function remind_spin_prizes() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'remind-spin-prizes') then
    perform cron.schedule('remind-spin-prizes', '0 2 * * *',
                          'select remind_spin_prizes();');
  end if;
end $$;
