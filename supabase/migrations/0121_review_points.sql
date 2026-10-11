-- Сэтгэгдлийн урамшуулал: худалдаж авсан усандаа сэтгэгдэл бичвэл V point.
--
-- Дүрэм:
--   * Зөвхөн ус (`product_id`) — багцын сэтгэгдэл урамшуулалгүй.
--   * Тухайн хэрэглэгчийн ХҮРГЭГДСЭН, төлбөр нь `paid` (буцаагдаагүй)
--     захиалгад тэр ус байх ёстой. Бэлгийн мөр (`is_gift`, `is_sample`)
--     тооцогдохгүй — худалдаж аваагүй усанд оноо өгөхгүй.
--   * (хэрэглэгч, ус) хос бүрт НЭГ л удаа. `review_rewards` нь үүнийг
--     баталгаажуулна; сэтгэгдлээ засах, устгаад дахин бичих нь дахин оноо
--     авчрахгүй.
--   * Хэмжээ нь `settings.loyalty.reviewPoints` (админ тохируулна, 0 бол
--     унтарна). Оноо шууд зарцуулагдана — захиалга аль хэдийн хүргэгдсэн тул
--     түгжих шалтгаангүй.
--
-- Хоёр замаар олгогдоно: сэтгэгдэл бичигдэх/засагдах үед (захиалга аль
-- хэдийн хүргэгдсэн бол), эсвэл захиалга «Хүргэгдсэн» болох үед (сэтгэгдлийг
-- барааны хуудаснаас урьд нь бичсэн бол).

update settings
  set value = value || jsonb_build_object('reviewPoints', 500)
  where key = 'loyalty' and not (value ? 'reviewPoints');

create table if not exists review_rewards (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  points     int  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table review_rewards enable row level security;
drop policy if exists "review_rewards owner read" on review_rewards;
create policy "review_rewards owner read" on review_rewards for select
  using (user_id = auth.uid() or is_staff());
-- Бичилт зөвхөн доорх security definer функцээр.

/**
 * Нэг (хэрэглэгч, ус) хосын урамшууллыг олгоно — нөхцөл хангагдаагүй эсвэл
 * аль хэдийн олгосон бол юу ч хийхгүй. Олгосон оноог буцаана.
 */
create or replace function award_review_points(p_user uuid, p_product uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
begin
  if p_user is null or p_product is null then
    return 0;
  end if;

  select coalesce((value->>'reviewPoints')::int, 0) into v_points
    from settings where key = 'loyalty';
  if coalesce(v_points, 0) <= 0 then
    return 0;
  end if;

  if not exists (
    select 1
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.user_id = p_user
       and o.status = 'delivered'
       and o.payment_status = 'paid'
       and oi.product_id = p_product
       and not coalesce(oi.is_gift, false)
       and not coalesce(oi.is_sample, false)
  ) then
    return 0;
  end if;

  if not exists (
    select 1 from reviews where user_id = p_user and product_id = p_product
  ) then
    return 0;
  end if;

  insert into review_rewards (user_id, product_id, points)
    values (p_user, p_product, v_points)
    on conflict do nothing;
  if not found then
    return 0;
  end if;

  update profiles set loyalty_points = loyalty_points + v_points
    where id = p_user;
  insert into loyalty_ledger (user_id, delta, reason)
    values (p_user, v_points, 'review');
  return v_points;
end;
$$;

revoke all on function award_review_points(uuid, uuid)
  from public, anon, authenticated;

-- ── Сэтгэгдэл бичигдэх/засагдах үед ───────────────────────────────────
create or replace function trg_review_award_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    perform award_review_points(new.user_id, new.product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_award_points on reviews;
create trigger reviews_award_points
  after insert or update on reviews
  for each row execute function trg_review_award_points();

-- ── Захиалга «Хүргэгдсэн» болох үед ───────────────────────────────────
create or replace function trg_order_delivered_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
begin
  if new.user_id is null then
    return null;
  end if;
  for v_product in
    select distinct r.product_id
      from reviews r
      join order_items oi on oi.product_id = r.product_id
     where oi.order_id = new.id
       and r.user_id = new.user_id
  loop
    perform award_review_points(new.user_id, v_product);
  end loop;
  return null;
end;
$$;

drop trigger if exists orders_delivered_review_points on orders;
create trigger orders_delivered_review_points
  after update of status on orders
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function trg_order_delivered_review_points();
