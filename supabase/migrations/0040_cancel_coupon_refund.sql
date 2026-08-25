-- Захиалга цуцлагдахад хэрэглэсэн купоныг буцаана (requirement_final.md §5/§9:
-- «Цуцлах товч дарахад ашигласан оноо, купон буцаагдаж…»). Points already
-- reverse in update_order_status (0019/0024); the coupon the order SPENT was
-- staying burned: used_count kept its increment and the redemption row kept
-- counting against max_uses_per_user. Extends orders_on_cancelled (0032).

create or replace function orders_on_cancelled()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
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

    -- Give back the coupon this order USED: undo the shop-wide counter and
    -- drop the per-user redemption row so a limited-use code can be spent
    -- again. discount > 0 is the proof the coupon actually applied — an
    -- invalid code at place time never incremented anything.
    if new.coupon_code is not null and coalesce(new.discount, 0) > 0 then
      update coupons set used_count = greatest(used_count - 1, 0)
        where upper(code) = upper(new.coupon_code);
      delete from coupon_redemptions r
        using coupons c
        where r.coupon_id = c.id
          and r.order_id = new.id
          and upper(c.code) = upper(new.coupon_code);
    end if;

    -- The 300k+ reward coupon granted FOR this order: gone unless already
    -- redeemed on some other order.
    delete from coupons c
      where c.source_order_id = new.id
        and not exists (
          select 1 from coupon_redemptions r where r.coupon_id = c.id
        );
  end if;
  return new;
end $$;
