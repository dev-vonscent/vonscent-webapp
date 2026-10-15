-- Бүртгэлийн купоны хүчинтэй хугацааг «олгосон өдрийг оролцуулан N хоног»
-- болгоно (0135-д «олгосон өдрөөс хойш +N дэх өдөр» байсан).
--
-- 0135-ээр 30 хоног гэж тохируулахад купон 31 дэх өдрийн 23:59:59-д дуусаж,
-- «Миний купон»-д «31 хоног үлдсэн» гэж харагддаг байв — админы бичсэн
-- тоотой зөрнө. Олгосон өдрийг 1 дэх өдөр гэж тоолбол хэрэглэгчид яг
-- «30 хоног үлдсэн» гэж харагдана (`daysLeft` нь ceil).
--
-- Зөвхөн функцийн бие солигдоно (0135 prod-д хараахан ажиллаагүй ч dev-д
-- ажилласан тул тэр файлыг засахгүй). Аль хэдийн олгосон купонд нөлөөгүй.

create or replace function grant_signup_coupons(p_user uuid, p_phone text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  c campaigns%rowtype;
  v_grant uuid;
  v_ends timestamptz;
  i int;
begin
  -- Туг хаалттай үед юу ч үүсэхгүй (CLAUDE.md, 0130-ийн сургамж).
  if not feature_enabled('campaigns') then return null; end if;
  if p_user is null then return null; end if;

  -- Давхцал trigger-ээр хаалттай тул ихэнхдээ ганц мөр; хуучин өгөгдөлд
  -- хамгаалалт болгож хамгийн сүүлд эхэлснийг сонгоно.
  select * into c from campaigns
   where type = 'signup_coupon' and is_active
     and v_today between starts_on and ends_on
   order by starts_on desc, created_at desc
   limit 1;
  if not found then return null; end if;

  -- Нэг хэрэглэгч / нэг утас — нэг удаа. Unique хязгаарлалт зэрэг дуудлагыг
  -- ч барина: хоёр дахь нь мөр оруулж чадахгүй, купон үүсгэхгүй.
  insert into campaign_grants (campaign_id, user_id, phone)
  values (c.id, p_user, nullif(btrim(coalesce(p_phone, '')), ''))
  on conflict do nothing
  returning id into v_grant;
  if v_grant is null then return null; end if;

  -- Олгосон өдөр = 1 дэх өдөр: N хоног → (өнөөдөр + N − 1)-ийн 23:59:59.
  v_ends := ((v_today + c.coupon_valid_days)::timestamp
              at time zone 'Asia/Ulaanbaatar') - interval '1 second';

  for i in 1..c.coupons_per_user loop
    insert into coupons (code, user_id, type, value, min_subtotal,
                         max_uses, max_uses_per_user, ends_at, is_active,
                         source, campaign_id)
    values (generate_coupon_code('VN'), p_user, 'fixed', c.coupon_value,
            c.min_subtotal, 1, 1, v_ends, true, 'campaign', c.id);
  end loop;

  return jsonb_build_object('campaignId', c.id,
    'count', c.coupons_per_user, 'value', c.coupon_value);
end $$;

revoke all on function grant_signup_coupons(uuid, text) from public, anon, authenticated;
do $$ begin
  grant execute on function grant_signup_coupons(uuid, text) to service_role;
exception when undefined_object then null; end $$;
