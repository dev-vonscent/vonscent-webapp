-- Бэлгийн карт (docs/planning/gift-cards-plan.md, PR1). Feature flag: `gift_cards`.
--
-- Expand only: шинэ хүснэгт, nullable/default-тэй багана, check-ийн өргөтгөл,
-- шинэ RPC. Хуучин код (place_order, тайлан) өөрчлөлтгүй ажиллана.
--
-- Туг хаалттай үед prod-д юу ч хуримтлагдахгүй:
--   * place_gift_card_order → FEATURE_DISABLED (захиалга, карт үүсэхгүй)
--   * redeem_gift_card      → FEATURE_DISABLED
--   * expire_gift_cards (cron) → шууд return
--   * Бусад өөрчлөлт (mark_order_paid-ийн салаа, guard trigger,
--     user_lifetime_spend шүүлт) зөвхөн `order_type = 'gift_card'` мөрөнд
--     хамаарна — ийм мөр зөвхөн place_gift_card_order-оор үүснэ.
--
-- Клиентийн шийдвэр (plan §12): нэвтрэлт заавал, сагсгүй шууд худалдан
-- авалт, купон/оноо хэрэглэхгүй, буцаалтгүй, худалдан авагчийн оноо карт
-- ашиглагдах эсвэл 7 хоногийн дараа нээгдэнэ, зэрэглэлийн зарцуулалтад
-- орохгүй, код 1 жил (admin сунгана), оноо болсны дараа хугацаагүй.

insert into feature_flags (key) values ('gift_cards') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. orders.order_type, order_items.line_kind = 'gift_card'
------------------------------------------------------------------------------

alter table orders
  add column if not exists order_type text not null default 'goods';

do $$
begin
  alter table orders add constraint orders_order_type_chk
    check (order_type in ('goods', 'gift_card'));
exception when duplicate_object then null;
end $$;

create index if not exists orders_gift_card_idx
  on orders (created_at) where order_type = 'gift_card';

-- 0146-ийн inline check (`order_items_line_kind_check`) → gift_card нэмнэ.
alter table order_items drop constraint if exists order_items_line_kind_check;
do $$
begin
  alter table order_items add constraint order_items_line_kind_check
    check (line_kind in ('perfume', 'extra', 'gift_card'));
exception when duplicate_object then null;
end $$;

-- Мөрийн хэлбэр: 0146-ийн хоёр салаа хэвээр + gift_card (нөөц, сав, ml-гүй).
alter table order_items drop constraint if exists order_items_kind_chk;
alter table order_items add constraint order_items_kind_chk check (
  (line_kind = 'perfume'
     and ml is not null and extra_variant_id is null
     and extra_product_id is null and extra_inventory_mode is null
     and extra_state is null and restocked_qty = 0)
  or
  (line_kind = 'extra'
     and ml is null and product_id is null and variant_id is null
     and collection_id is null and not is_gift and not is_sample
     and extra_variant_id is not null and extra_product_id is not null
     and extra_inventory_mode is not null and extra_state is not null
     and ((extra_inventory_mode = 'shared_vial') = (vial_id is not null)))
  or
  (line_kind = 'gift_card'
     and ml is null and product_id is null and variant_id is null
     and collection_id is null and not is_gift and not is_sample
     and extra_variant_id is null and extra_product_id is null
     and extra_inventory_mode is null and extra_state is null
     and vial_id is null and restocked_qty = 0 and qty = 1)
);

------------------------------------------------------------------------------
-- 2. gift_card_designs — загвар (улирлынхыг админ deploy-гүй асаана)
------------------------------------------------------------------------------

create table if not exists gift_card_designs (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  title text not null check (length(btrim(title)) between 1 and 40),
  -- Карт дээрх гарчиг: «Төрсөн өдрийн мэнд хүргэе!» (2 мөр хүртэл).
  heading text not null check (length(btrim(heading)) between 1 and 60),
  -- Мэндчилгээний талбарын санал болгох текст.
  default_message text check (length(default_message) <= 120),
  -- Storage-ийн зам; null бол хуудас `bg_color`-оор зурна.
  image_path text,
  bg_color text not null default '#0E1B3B' check (bg_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color text not null default '#FFFFFF' check (text_color ~ '^#[0-9a-fA-F]{6}$'),
  muted_color text not null default '#B8C0D6' check (muted_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table gift_card_designs enable row level security;
-- Загвар бол нийтийн мэдээлэл (зочин ч хуудсыг харна, plan §12-Q1).
drop policy if exists gift_card_designs_read on gift_card_designs;
create policy gift_card_designs_read on gift_card_designs
  for select to anon, authenticated using (is_active);

-- Canvas-ийн 8 загвар (plan §9). Зураг нь дараа админаас (image_path).
-- Үндсэн нь брэндийн navy (§12-Q7); бусдын өнгө canvas-аас.
insert into gift_card_designs
  (id, title, heading, default_message, bg_color, text_color, muted_color, accent_color, sort_order)
values
  ('classic', 'Үндсэн', 'Танд зориулав',
   'Өөрт тохирох үнэрээ өөрөө сонгоорой. Хамгийн сайхан бэлэг бол сонголт.',
   '#0E1B3B', '#FFFFFF', '#B8C0D6', '#C9A86A', 10),
  ('birthday', 'Төрсөн өдөр', 'Төрсөн өдрийн мэнд хүргэе!',
   'Шинэ насандаа өөртөө тохирох үнэрээ олоорой. Хайртай шүү!',
   '#C2245C', '#FFFFFF', '#FBE3EC', '#0E0E0E', 20),
  ('love', 'Хайртай хүндээ', 'Хайртай хүндээ',
   'Чамайг санагдуулах үнэр бүрт баярлалаа.',
   '#F6E7EA', '#5A1028', '#8A4A5C', '#C2245C', 30),
  ('thank-you', 'Баярлалаа', 'Баярлалаа',
   'Үргэлж дэргэд минь байдагт чинь баярлалаа.',
   '#F3EFE6', '#1F2A1F', '#5B655B', '#7A8F5A', 40),
  ('march-8', '3-р сарын 8', 'Эмэгтэйчүүдийн баярын мэнд',
   'Танд зориулсан энэ өдөр үнэр шиг сайхан өнгөрөг.',
   '#FBEFF3', '#5A1028', '#8A4A5C', '#C2245C', 50),
  ('new-year', 'Шинэ жил', 'Шинэ оны мэнд хүргэе!',
   'Шинэ ондоо шинэ үнэрээр угтаарай.',
   '#0E1B3B', '#FFFFFF', '#B8C0D6', '#C9A86A', 60),
  ('tsagaan-sar', 'Цагаан сар', 'Сар шинэдээ сайхан шинэлээрэй',
   'Цагаан сарын баярын мэнд хүргэе. Энх тунх, эрүүл энхээр шинэлээрэй!',
   '#F4F7FB', '#0D2A52', '#42597A', '#C79A3B', 70),
  ('teacher', 'Багш нарын баяр', 'Багшдаа баярлалаа',
   'Бидэнд өгсөн бүх зүйлд тань баярлалаа.',
   '#F1F4EE', '#1E3323', '#4D6352', '#B07A2A', 80)
on conflict (id) do nothing;

------------------------------------------------------------------------------
-- 3. gift_cards
------------------------------------------------------------------------------

create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid not null unique references order_items(id) on delete cascade,
  -- Бүртгэл устгагдвал карт (хүлээн авагчийнх) хүчинтэй хэвээр.
  buyer_id uuid references profiles(id) on delete set null,
  amount int not null check (amount in (100000, 200000, 300000, 500000)),
  design_id text not null references gift_card_designs(id),
  recipient_name text not null check (length(btrim(recipient_name)) between 1 and 40),
  message text check (length(message) <= 120),
  from_name text not null check (length(btrim(from_name)) between 1 and 40),
  -- null = «Өөрөө өгнө» (код зөвхөн худалдан авагчийн бүртгэлд).
  recipient_email text check (recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Товлосон илгээлт (null = төлбөр орсон даруйд).
  send_at timestamptz,
  -- Гараар бичих код: VON-XXXX-XXXX (32 тэмдэгт, 0/O/1/I-гүй).
  code text not null unique check (code ~ '^VON-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  -- Холбоос/QR: /gift/<token> — 122 bit.
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'redeemed', 'expired', 'void')),
  issued_at timestamptz,
  expires_at timestamptz,
  sent_at timestamptz,
  send_count int not null default 0 check (send_count >= 0),
  last_send_error text,
  redeemed_by uuid references profiles(id) on delete set null,
  redeemed_at timestamptz,
  points int,                      -- олгосон V point (redeemRate-аар)
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_cards_state_chk check (
    (status = 'pending' and issued_at is null and redeemed_at is null)
    or (status in ('active', 'expired') and issued_at is not null
        and expires_at is not null and redeemed_at is null)
    or (status = 'redeemed' and issued_at is not null and redeemed_at is not null
        and redeemed_by is not null and points is not null)
    or (status = 'void' and voided_at is not null and redeemed_at is null)
  )
);

create index if not exists gift_cards_order_idx on gift_cards (order_id);
create index if not exists gift_cards_buyer_idx on gift_cards (buyer_id, created_at desc);
create index if not exists gift_cards_redeemed_by_idx on gift_cards (redeemed_by)
  where redeemed_by is not null;
create index if not exists gift_cards_active_expiry_idx on gift_cards (expires_at)
  where status = 'active';
create index if not exists gift_cards_unsent_idx on gift_cards (send_at)
  where status = 'active' and sent_at is null and recipient_email is not null;

-- Код, token нь нууц: anon/authenticated-д ямар ч эрх байхгүй. Бүх уншилт
-- route handler → service role, эрх шалгалт handler дотор (plan §3.2).
alter table gift_cards enable row level security;
revoke all on table gift_cards from anon, authenticated;

-- Админ үйлдлийн түүх (дахин илгээх, имэйл засах, хугацаа сунгах).
create table if not exists gift_card_events (
  id bigint generated always as identity primary key,
  gift_card_id uuid not null references gift_cards(id) on delete cascade,
  kind text not null check (kind in (
    'issued', 'sent', 'send_failed', 'resent', 'email_changed',
    'redeemed', 'expired', 'extended', 'voided')),
  actor uuid references profiles(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists gift_card_events_card_idx
  on gift_card_events (gift_card_id, created_at desc);
alter table gift_card_events enable row level security;
revoke all on table gift_card_events from anon, authenticated;

-- Хүлээн авагчийн оноо аль картаас ирснийг (order_id нь худалдан авагчийнх
-- тул хүлээн авагчийн ledger-т тавихгүй).
alter table loyalty_ledger
  add column if not exists gift_card_id uuid references gift_cards(id) on delete set null;

------------------------------------------------------------------------------
-- 4. Код / token үүсгэгч — pgcrypto-гүй (security definer search_path-д
--    extensions schema байхгүй). gen_random_uuid()-ийн бүрэн санамсаргүй
--    байтууд: 0–5, 10–15 (6-д version, 8-д variant бит).
------------------------------------------------------------------------------

create or replace function gift_card_new_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 тэмдэгт
  v_bytes bytea;
  v_raw text;
  v_pos int[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  i int;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_raw := '';
    foreach i in array v_pos loop
      -- 256 % 32 = 0 → хазайлтгүй.
      v_raw := v_raw || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    v_raw := 'VON-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
    exit when not exists (select 1 from gift_cards where code = v_raw);
  end loop;
  return v_raw;
end $$;

create or replace function gift_card_new_token()
returns text language sql volatile set search_path = public as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

revoke all on function gift_card_new_code() from public, anon, authenticated;
revoke all on function gift_card_new_token() from public, anon, authenticated;

------------------------------------------------------------------------------
-- 5. place_gift_card_order — сагсгүй, шууд худалдан авалт (§4.1)
--
-- p_card: {amount, design_id, recipient_name, message, from_name,
--          recipient_email, send_at, contact_name, contact_phone,
--          contact_email, reserve_minutes}
-- Хариу нь place_order-тэй ижил `order_summary()` хэлбэр — route нь
-- ensureInvoice, pay_token-ийг адилхан ашиглана.
------------------------------------------------------------------------------

create or replace function place_gift_card_order(p_user uuid, p_card jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_amount int;
  v_design gift_card_designs;
  v_order_id uuid;
  v_order_no text;
  v_item_id uuid;
  v_email text;
  v_send_at timestamptz;
  v_reserve_min int := least(greatest(coalesce((p_card->>'reserve_minutes')::int, 30), 5), 120);
begin
  if not feature_enabled('gift_cards') then
    raise exception 'FEATURE_DISABLED' using errcode = 'check_violation';
  end if;
  -- Худалдан авахад нэвтрэлт заавал (§12-Q1).
  if p_user is null or not exists (select 1 from profiles where id = p_user) then
    raise exception 'AUTH_REQUIRED' using errcode = 'check_violation';
  end if;

  v_amount := (p_card->>'amount')::int;
  if v_amount is null or v_amount not in (100000, 200000, 300000, 500000) then
    raise exception 'GIFT_CARD_AMOUNT' using errcode = 'check_violation';
  end if;

  select * into v_design from gift_card_designs
   where id = p_card->>'design_id' and is_active;
  if not found then
    raise exception 'GIFT_CARD_DESIGN' using errcode = 'check_violation';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_card->>'recipient_email', ''))), '');
  v_send_at := nullif(p_card->>'send_at', '')::timestamptz;
  if v_send_at is not null then
    if v_email is null then
      raise exception 'GIFT_CARD_SEND_AT_NEEDS_EMAIL' using errcode = 'check_violation';
    end if;
    -- Өнгөрсөн цаг = одоо илгээнэ; 1 жилээс хол товлохгүй (код хугацаатай).
    if v_send_at > now() + interval '360 days' then
      raise exception 'GIFT_CARD_SEND_AT' using errcode = 'check_violation';
    end if;
    if v_send_at <= now() then v_send_at := null; end if;
  end if;

  insert into orders (
    user_id, order_type, payment_method, contact_name, contact_phone, contact_email,
    ship_city, ship_detail, note, shipping_fee, reserve_expires_at,
    subtotal, gross_subtotal, discount, loyalty_used, total, deliver_on
  ) values (
    p_user, 'gift_card', 'qpay',
    coalesce(nullif(btrim(p_card->>'contact_name'), ''), 'Хэрэглэгч'),
    coalesce(nullif(btrim(p_card->>'contact_phone'), ''), ''),
    nullif(btrim(coalesce(p_card->>'contact_email', '')), ''),
    '', 'Бэлгийн карт — хүргэлтгүй', null, 0,
    now() + (v_reserve_min || ' minutes')::interval,
    v_amount, v_amount, 0, 0, v_amount, null
  ) returning id, order_no into v_order_id, v_order_no;

  insert into order_items (
    order_id, line_no, line_kind, product_name, brand, ml,
    unit_price, list_price, qty, line_total, variant_label, image_url
  ) values (
    v_order_id, 1, 'gift_card', 'Бэлгийн карт', 'Vonscent', null,
    v_amount, v_amount, 1, v_amount, v_design.title,
    -- Мөрийн thumbnail: загварын жижиг карт (route нь хувийн өгөгдөлгүй).
    '/api/gift-cards/designs/' || v_design.id || '/thumb'
  ) returning id into v_item_id;

  insert into gift_cards (
    order_id, order_item_id, buyer_id, amount, design_id,
    recipient_name, message, from_name, recipient_email, send_at,
    code, token
  ) values (
    v_order_id, v_item_id, p_user, v_amount, v_design.id,
    btrim(p_card->>'recipient_name'),
    nullif(btrim(coalesce(p_card->>'message', '')), ''),
    btrim(p_card->>'from_name'),
    v_email, v_send_at,
    gift_card_new_code(), gift_card_new_token()
  );

  return order_summary(v_order_id);
end $$;

revoke all on function place_gift_card_order(uuid, jsonb) from public, anon, authenticated;
grant execute on function place_gift_card_order(uuid, jsonb) to service_role;

------------------------------------------------------------------------------
-- 6. mark_order_paid — 0149-ийн бие хэвээр + gift_card салаа (§4.3, §4.4)
--
-- Бүх төлбөрийн зам (webhook, status, reconcile, админ гараар) энд нэгддэг
-- тул картыг ИДЭВХЖҮҮЛЭХ нь DB дотор, атомаар. Имэйл нь TS талд (sent_at).
------------------------------------------------------------------------------

create or replace function mark_order_paid(
  p_order uuid,
  p_by uuid default null,
  p_source text default 'qpay'
)
returns void language plpgsql as $$
declare
  v_item record;
  v_user uuid;
  v_status payment_status_t;
  v_order_status order_status_t;
  v_subtotal int;
  v_discount int;
  v_base int;
  v_earn_per int;
  v_earn_points int;
  v_lock_hours numeric;
  v_earned int;
  v_rate int;
  v_now_ub timestamp;
  v_min_day date;
  v_deliver_old date;
  v_deliver_new date;
  v_available timestamptz;
  v_note text;
  v_order_type text;   -- 0179
  v_order_no text;     -- 0179
begin
  select user_id, payment_status, status, subtotal, discount, deliver_on,
         order_type, order_no
    into v_user, v_status, v_order_status, v_subtotal, v_discount, v_deliver_old,
         v_order_type, v_order_no
    from orders where id = p_order for update;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;
  -- Цуцлагдсан захиалгын мл, оноо, купон аль хэдийн буцсан (0073).
  if v_order_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'check_violation';
  end if;
  -- 0149: төлбөрийг зөвхөн хүлээгдэж буй / баталгаажсан захиалгад (§6.4).
  if v_order_status not in ('pending', 'confirmed') or v_status = 'refunded' then
    raise exception 'ILLEGAL_TRANSITION:%:paid', v_order_status
      using errcode = 'check_violation';
  end if;

  v_note := case p_source
    when 'manual' then 'Төлбөр төлөгдсөн (гараар тэмдэглэсэн)'
    when 'mock'   then 'Төлбөр төлөгдсөн (mock)'
    else 'Төлбөр төлөгдсөн (QPay)'
  end;

  -- ── 0179: Бэлгийн карт — хүргэлтгүй, шууд «хүргэгдсэн» ─────────────────
  -- Туг энд шалгахгүй: захиалга үүссэн (туг асаалттай байсан) бол мөнгө
  -- орсон картыг заавал идэвхжүүлнэ.
  if v_order_type = 'gift_card' then
    if v_user is not null then
      perform 1 from profiles where id = v_user for update;
    end if;

    update orders set payment_status = 'paid', status = 'delivered',
      deliver_on = null, reserve_expires_at = null where id = p_order;
    insert into order_status_history (order_id, status, note, changed_by)
      values (p_order, 'delivered', 'Бэлгийн карт — ' || v_note, p_by);

    update gift_cards
       set status = 'active', issued_at = now(),
           expires_at = now() + interval '1 year', updated_at = now()
     where order_id = p_order and status = 'pending';
    insert into gift_card_events (gift_card_id, kind, actor, data)
      select id, 'issued', p_by, jsonb_build_object('source', p_source)
        from gift_cards where order_id = p_order and status = 'active';

    -- Худалдан авагчийн оноо (K12): зэрэглэлийн хувиар. Картын захиалга
    -- зарцуулалтад орохгүй (§12-Q3) тул user_lifetime_spend-ээс хасах
    -- шаардлагагүй. Карт ашиглагдах эсвэл 7 хоногийн дараа нээгдэнэ (§12-Q4).
    if v_user is not null then
      select coalesce((value->>'earnPer')::int, 100),
             coalesce((value->>'earnPoints')::int, 1)
        into v_earn_per, v_earn_points
        from settings where key = 'loyalty';
      v_earn_per := coalesce(v_earn_per, 100);
      v_earn_points := coalesce(v_earn_points, 1);
      v_base := greatest(coalesce(v_subtotal, 0), 0);
      if feature_enabled('user_tiers') then
        v_rate := tier_rate_for_spend(user_lifetime_spend(v_user));
        v_earned := floor(v_base::bigint * v_rate / 100);
      elsif v_earn_per > 0 then
        v_earned := floor(v_base / v_earn_per) * v_earn_points;
      else
        v_earned := 0;
      end if;
      if v_earned > 0 then
        update profiles set pending_points = pending_points + v_earned
          where id = v_user;
        insert into loyalty_ledger
          (user_id, order_id, delta, reason, available_at, released)
          values (v_user, p_order, v_earned, 'earn',
                  now() + interval '7 days', false);
      end if;

      perform notify_user(
        v_user, 'order_paid',
        v_order_no || ' — бэлгийн картын төлбөр баталгаажлаа',
        'Картаа «Бэлгийн карт» хэсгээс харж, илгээх боломжтой.',
        '/account/gift-cards',
        jsonb_build_object('orderId', p_order),
        'order:' || p_order || ':order_paid'
      );
    end if;
    return;
  end if;
  -- ── /0179 ───────────────────────────────────────────────────────────────

  v_now_ub := now() at time zone 'Asia/Ulaanbaatar';
  v_min_day := v_now_ub::date + 1;
  v_deliver_new := greatest(coalesce(v_deliver_old, v_min_day), v_min_day);

  -- Түгжих дараалал: profiles → inventory (0149).
  if v_user is not null then
    perform 1 from profiles where id = v_user for update;
  end if;
  perform 1 from inventory
   where product_id in (select product_id from order_items
                         where order_id = p_order and line_kind = 'perfume'
                           and product_id is not null)
   order by product_id for update;

  update orders set payment_status = 'paid', status = 'confirmed',
    deliver_on = v_deliver_new,
    reserve_expires_at = null where id = p_order;

  -- Шингэн төлбөрөөр commit; нэмэлт бараа, сав хүргэлтээр (§6.3).
  for v_item in
    select product_id, sum(ml * qty)::int as need from order_items
     where order_id = p_order and line_kind = 'perfume' and product_id is not null
     group by product_id order by product_id
  loop
    perform commit_inventory(v_item.product_id, v_item.need);
  end loop;

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, 'confirmed', v_note, p_by);

  if v_deliver_old is not null and v_deliver_new <> v_deliver_old then
    insert into order_status_history (order_id, status, note)
      values (p_order, 'confirmed',
        'Хүргэх өдөр ' || to_char(v_deliver_old, 'MM/DD') || ' → ' ||
        to_char(v_deliver_new, 'MM/DD') || ' болж шилжлээ (төлбөр ' ||
        to_char(v_now_ub, 'MM/DD HH24:MI') || '-д төлөгдсөн)');
  end if;

  if v_user is not null then
    select coalesce((value->>'earnPer')::int, 100),
           coalesce((value->>'earnPoints')::int, 1),
           coalesce((value->>'lockHours')::numeric, 24)
      into v_earn_per, v_earn_points, v_lock_hours
      from settings where key = 'loyalty';
    v_earn_per := coalesce(v_earn_per, 100);
    v_earn_points := coalesce(v_earn_points, 1);
    v_lock_hours := greatest(coalesce(v_lock_hours, 24), 0);
    -- Points are earned on the post-coupon product subtotal, never shipping.
    -- Нэмэлт бараа ч бараа — дүнд орно (§2.1 №9).
    v_base := greatest(coalesce(v_subtotal,0) - coalesce(v_discount,0), 0);
    if feature_enabled('user_tiers') then
      v_rate := tier_rate_for_spend(
        greatest(user_lifetime_spend(v_user) - v_base, 0));
      v_earned := floor(v_base::bigint * v_rate / 100);
    elsif v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
    else
      v_earned := 0;
    end if;
    if v_earned > 0 then
      v_available := (v_deliver_new::timestamp
                       + (v_lock_hours || ' hours')::interval)
                     at time zone 'Asia/Ulaanbaatar';
      update profiles set pending_points = pending_points + v_earned
        where id = v_user;
      insert into loyalty_ledger
        (user_id, order_id, delta, reason, available_at, released)
        values (v_user, p_order, v_earned, 'earn', v_available, false);
      if v_available <= now() then
        perform release_order_points(p_order);
      end if;
    end if;
  end if;
end $$;

------------------------------------------------------------------------------
-- 7. redeem_gift_card — код эсвэл token → V point (§4.5)
--
-- Хариу: {ok, reason?, amount, points, card_id}. reason: NOT_FOUND,
-- ALREADY_REDEEMED, EXPIRED, VOID, NOT_ACTIVE. Нэг удаа л (row lock).
-- Оноо шууд ашиглагдана (lock-гүй) — бэлэг бол мөнгө.
------------------------------------------------------------------------------

create or replace function redeem_gift_card(p_user uuid, p_code text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_card gift_cards;
  v_rate numeric;
  v_points int;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not feature_enabled('gift_cards') then
    raise exception 'FEATURE_DISABLED' using errcode = 'check_violation';
  end if;
  if p_user is null or not exists (select 1 from profiles where id = p_user) then
    raise exception 'AUTH_REQUIRED' using errcode = 'check_violation';
  end if;

  -- «von7k4pq9xm», «VON 7K4P Q9XM» г.м. бичлэгийг зөвшөөрнө.
  if length(v_code) = 11 and left(v_code, 3) = 'VON' then
    v_code := 'VON-' || substr(v_code, 4, 4) || '-' || substr(v_code, 8, 4);
  elsif length(v_code) = 8 then
    v_code := 'VON-' || substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
  else
    v_code := null;
  end if;

  if p_token is not null and p_token <> '' then
    select * into v_card from gift_cards where token = lower(p_token) for update;
  elsif v_code is not null then
    select * into v_card from gift_cards where code = v_code for update;
  end if;
  if v_card.id is null then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  if v_card.status = 'redeemed' then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_REDEEMED',
      'mine', v_card.redeemed_by = p_user, 'redeemed_at', v_card.redeemed_at);
  elsif v_card.status = 'void' then
    return jsonb_build_object('ok', false, 'reason', 'VOID');
  elsif v_card.status = 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_ACTIVE');
  elsif v_card.status = 'expired' or v_card.expires_at <= now() then
    if v_card.status = 'active' then
      update gift_cards set status = 'expired', updated_at = now() where id = v_card.id;
      insert into gift_card_events (gift_card_id, kind) values (v_card.id, 'expired');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'EXPIRED',
      'expires_at', v_card.expires_at);
  end if;

  select coalesce((value->>'redeemRate')::numeric, 1) into v_rate
    from settings where key = 'loyalty';
  v_rate := coalesce(nullif(v_rate, 0), 1);
  v_points := floor(v_card.amount / v_rate);

  perform 1 from profiles where id = p_user for update;
  update gift_cards
     set status = 'redeemed', redeemed_by = p_user, redeemed_at = now(),
         points = v_points, updated_at = now()
   where id = v_card.id;
  update profiles set loyalty_points = loyalty_points + v_points where id = p_user;
  insert into loyalty_ledger (user_id, delta, reason, gift_card_id)
    values (p_user, v_points, 'gift_card', v_card.id);
  insert into gift_card_events (gift_card_id, kind, actor, data)
    values (v_card.id, 'redeemed', p_user, jsonb_build_object('points', v_points));

  -- Худалдан авагчийн оноо карт ашиглагдмагц нээгдэнэ (§12-Q4).
  perform release_order_points(v_card.order_id);

  return jsonb_build_object('ok', true, 'amount', v_card.amount,
    'points', v_points, 'card_id', v_card.id);
end $$;

revoke all on function redeem_gift_card(uuid, text, text) from public, anon, authenticated;
grant execute on function redeem_gift_card(uuid, text, text) to service_role;

------------------------------------------------------------------------------
-- 8. Буцаалтгүй (§12-Q6) ба төлөгдөөгүй захиалгын карт void
------------------------------------------------------------------------------

create or replace function orders_gift_card_guard()
returns trigger language plpgsql as $$
begin
  -- Төлөгдсөн карт эцсийн төлөвтэй (delivered/paid): цуцлах, буцаах,
  -- delivered → shipping → cancelled тойруу замыг ч хаана.
  if old.order_type = 'gift_card' and old.payment_status = 'paid'
     and (new.status is distinct from old.status
          or new.payment_status is distinct from old.payment_status) then
    raise exception 'GIFT_CARD_NOT_REFUNDABLE' using errcode = 'check_violation';
  end if;
  if new.order_type is distinct from old.order_type then
    raise exception 'ORDER_TYPE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists orders_gift_card_guard on orders;
create trigger orders_gift_card_guard
  before update of status, payment_status, order_type on orders
  for each row execute function orders_gift_card_guard();

create or replace function orders_gift_card_void()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update gift_cards
     set status = 'void', voided_at = now(), void_reason = 'unpaid', updated_at = now()
   where order_id = new.id and status = 'pending';
  return new;
end $$;

drop trigger if exists orders_gift_card_void on orders;
create trigger orders_gift_card_void
  after update of status on orders
  for each row
  when (new.order_type = 'gift_card' and new.status = 'cancelled'
        and old.status is distinct from 'cancelled')
  execute function orders_gift_card_void();

------------------------------------------------------------------------------
-- 9. Картын захиалга бусад урамшуулалд орохгүй
--
-- * Зэрэглэлийн зарцуулалт (§12-Q3): хүлээн авагч тэр мөнгөөр бараа авахад
--   тоологдоно — давхардахгүй.
-- * Хүрдний эрх, автомат купон: карт купон/хөнгөлөлтгүй бараа (K11) —
--   түүгээр урамшуулал «тарих»-аас сэргийлнэ (plan §4.4, таамаглал).
-- * orders_user_notify: «хүргэгдлээ» мэдэгдэл картад утгагүй;
--   mark_order_paid-ийн салаа өөрийн мэдэгдлийг явуулна.
------------------------------------------------------------------------------

create or replace function user_lifetime_spend(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(subtotal - coalesce(discount, 0), 0)), 0)::bigint
    from orders
   where user_id = p_user
     and payment_status = 'paid'
     and status <> 'cancelled'
     and order_type = 'goods';   -- 0179
$$;

create or replace function orders_grant_spins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not feature_enabled('lucky_wheel') then return new; end if;
  if new.order_type = 'gift_card' then return new; end if;   -- 0179
  perform grant_order_spins(new.id);
  return new;
end $$;

create or replace function orders_grant_reward_coupon()
returns trigger language plpgsql as $$
begin
  if new.order_type = 'gift_card' then return new; end if;   -- 0179
  perform grant_reward_coupon(new.id);
  return new;
end $$;

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
  -- 0179: картын захиалга өөрийн мэдэгдэлтэй (mark_order_paid).
  if new.order_type = 'gift_card' then
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

revoke all on function orders_user_notify() from public, anon, authenticated;

------------------------------------------------------------------------------
-- 10. Хугацаа: дуусгах (cron), админ сунгах (§4.7, §12-Q8)
--
-- Хугацаа = кодыг V point болгох хугацаа (төлбөрөөс 1 жил). Оноо болсны
-- дараа хугацаагүй.
------------------------------------------------------------------------------

create or replace function expire_gift_cards()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if not feature_enabled('gift_cards') then
    return 0;
  end if;
  with x as (
    update gift_cards set status = 'expired', updated_at = now()
     where status = 'active' and expires_at <= now()
     returning id
  ), e as (
    insert into gift_card_events (gift_card_id, kind) select id, 'expired' from x
  )
  select count(*) into v_n from x;
  return v_n;
end $$;

revoke all on function expire_gift_cards() from public, anon, authenticated;
grant execute on function expire_gift_cards() to service_role;

create or replace function admin_extend_gift_card(
  p_card uuid, p_until timestamptz, p_by uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_card gift_cards;
begin
  if not feature_enabled('gift_cards') then
    raise exception 'FEATURE_DISABLED' using errcode = 'check_violation';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'check_violation';
  end if;
  if p_until is null or p_until <= now() or p_until > now() + interval '2 years' then
    raise exception 'GIFT_CARD_EXTEND_DATE' using errcode = 'check_violation';
  end if;

  select * into v_card from gift_cards where id = p_card for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  if v_card.status not in ('active', 'expired') then
    raise exception 'GIFT_CARD_NOT_EXTENDABLE:%', v_card.status
      using errcode = 'check_violation';
  end if;

  update gift_cards
     set status = 'active', expires_at = p_until, updated_at = now()
   where id = p_card;
  insert into gift_card_events (gift_card_id, kind, actor, data)
    values (p_card, 'extended', p_by, jsonb_build_object(
      'from', v_card.expires_at, 'to', p_until,
      'reason', btrim(p_reason), 'was', v_card.status));
  return jsonb_build_object('ok', true, 'expires_at', p_until);
end $$;

revoke all on function admin_extend_gift_card(uuid, timestamptz, uuid, text)
  from public, anon, authenticated;
grant execute on function admin_extend_gift_card(uuid, timestamptz, uuid, text)
  to service_role;

-- 01:00 UTC = 09:00 Улаанбаатар.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'expire-gift-cards') then
    perform cron.schedule('expire-gift-cards', '0 1 * * *',
                          'select expire_gift_cards();');
  end if;
end $$;
