-- Хувийн купоны хугацаа дуусахаас 3 хоногийн өмнө сануулга (pg_cron).
--
-- Хамрах хүрээ: хэрэглэгчид олгогдсон (`user_id` not null), хугацаатай,
-- одоо ашиглаж болох бүх купон — бүртгэлийн, түвшний, кампанит ажлын,
-- азын хүрдний, буцаалтын г.м. эх үүсвэрээс үл хамаарна. Нийтийн купон
-- (`user_id` null) кодоор л ажилладаг тул хэнд сануулахаа мэдэхгүй — орохгүй.
--
-- Нэг хэрэглэгчид нэг өдөр НЭГ мэдэгдэл: олон купонтой бол нэгтгэнэ.
-- Купон бүрийг `expiry_reminded_at`-аар тэмдэглэж дахин сануулахгүй;
-- админ хугацааг сунгавал (тэмдэглэгээ нь шинэ цонхноос өмнө болох тул)
-- шинэ хугацааных нь өмнө дахин нэг удаа сануулна.
--
-- Тусдаа туггүй: `notify_user` өөрөө `notifications` тугаар хаалттай, шинэ
-- UI/эрх/оноо үүсгэхгүй. Хаалттай үед купон тэмдэглэгдэхгүй тул туг нээгдэхэд
-- сануулга алдагдахгүй.

alter table coupons add column if not exists expiry_reminded_at timestamptz;

create or replace function remind_expiring_coupons()
returns int language plpgsql security definer set search_path = public as $$
declare
  r     record;
  v_id  uuid;
  v_n   int := 0;
  v_day text := to_char(now() at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD');
begin
  if not feature_enabled('notifications') then
    return 0;
  end if;

  for r in
    with due as (
      select c.id, c.user_id, c.code, c.type, c.value, c.ends_at
        from coupons c
       where c.user_id is not null
         and c.is_active
         and not c.used_up
         and c.ends_at is not null
         and c.ends_at > now()
         and c.ends_at <= now() + interval '3 days'
         and (c.starts_at is null or c.starts_at <= now())
         -- Олгосон даруйдаа «дуусах гэж байна» гэж ирэхгүй (богино хугацаатай купон).
         and c.created_at < now() - interval '1 day'
         and (c.expiry_reminded_at is null
              or c.expiry_reminded_at < c.ends_at - interval '3 days')
         and (c.max_uses_per_user is null
              or (select count(*) from coupon_redemptions cr
                   where cr.coupon_id = c.id
                     and cr.user_id = c.user_id
                     and cr.cancelled_at is null) < c.max_uses_per_user)
    )
    select user_id,
           array_agg(id) as ids,
           count(*)::int as n,
           (array_agg(code  order by ends_at))[1] as code,
           (array_agg(type  order by ends_at))[1] as type,
           (array_agg(value order by ends_at))[1] as value,
           min(ends_at) as ends_at
      from due
     group by user_id
  loop
    v_id := notify_user(
      r.user_id,
      'coupon_expiring',
      'Купоны хугацаа дуусах гэж байна',
      case
        when r.n = 1 then format(
          '%s хөнгөлөлттэй купон тань %s хүртэл хүчинтэй. Амжиж ашиглаарай.',
          case when r.type = 'percent' then r.value || '%'
               else to_char(r.value, 'FM999,999,999') || '₮' end,
          to_char(r.ends_at at time zone 'Asia/Ulaanbaatar', 'YYYY.MM.DD'))
        else format(
          'Танд удахгүй дуусах %s купон байна, эхнийх нь %s хүртэл хүчинтэй. Амжиж ашиглаарай.',
          r.n,
          to_char(r.ends_at at time zone 'Asia/Ulaanbaatar', 'YYYY.MM.DD'))
      end,
      case when r.n = 1 then '/account/coupons/' || r.code
           else '/account/coupons' end,
      jsonb_build_object('couponIds', to_jsonb(r.ids)),
      'coupon_expiring:' || v_day,
      now()
    );
    -- null = өнөөдөр аль хэдийн илгээсэн (дахин ажилласан cron) — тэмдэглэхгүй,
    -- шинээр орсон купон нь маргаашийн сануулгад орно.
    if v_id is not null then
      update coupons set expiry_reminded_at = now() where id = any(r.ids);
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end $$;

revoke all on function remind_expiring_coupons() from public, anon, authenticated;

-- 02:00 UTC = 10:00 Улаанбаатар (remind-spin-prizes-тэй ижил цаг).
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'remind-expiring-coupons') then
    perform cron.schedule('remind-expiring-coupons', '0 2 * * *',
                          'select remind_expiring_coupons();');
  end if;
end $$;
