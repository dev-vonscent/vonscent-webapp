-- Автомат урамшууллын купон — олон шатлал.
--
-- Өмнө нь `settings.coupons.autoGrant` нэг босготой байв (ж: 300k+ → 10%).
-- Одоо `settings.coupons.tiers` жагсаалт: админ шатлал нэмж/хасна, хэд хэдийг
-- зэрэг асааж болно. Нэг захиалга ЗӨВХӨН НЭГ купон авна — хүрсэн идэвхтэй
-- шатлалуудаас хамгийн өндөр босготой нь. 100k+ ба 300k+ хоёулаа асаалттай
-- үед 350k-ийн захиалга зөвхөн 300k-ийн купоныг авна.
--
-- Шатлал бүр: { id, enabled, minTotal, type, value, validDays, maxUsesPerUser }.
-- Хэлбэрийг `/api/admin/settings` Zod-оор шалгана (`couponSettingsSchema`);
-- энд мөрийг өөрийн хэлбэрээр нь дахин хамгаална — буруу мөр алгасагдана,
-- төлбөрийн trigger-ийг унагахгүй.
--
-- Өгөгдөл хөрвүүлэхгүй: `tiers` байхгүй мөрийг хуучин `autoGrant`-аас нэг
-- шатлал гэж уншина. Ингэснээр шинэ код deploy болохоос өмнө (эсвэл хуучин
-- админ хуудас хадгалсан ч) урамшуулал яг өмнөх шигээ ажиллана.
--
-- Суурь дүн (0041) хэвээр: барааны дүн − купоны хямдрал; хүргэлт, оноо
-- ороогүй. Нэг захиалгад нэг купон (`source_order_id`) хэвээр.

create or replace function grant_reward_coupon(p_order uuid)
returns text language plpgsql as $$
declare
  v_user uuid;
  v_base int;
  v_settings jsonb;
  v_tiers jsonb;
  v_cfg jsonb;
  v_code text;
  v_uses int;
begin
  select user_id, greatest(coalesce(subtotal, 0) - coalesce(discount, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return null; end if;   -- зочинд хадгалах газар алга

  -- Төлбөр хоёр удаа баталгаажсан ч нэг захиалгад нэг л купон.
  if exists (select 1 from coupons where source_order_id = p_order) then
    return null;
  end if;

  select value into v_settings from settings where key = 'coupons';
  if jsonb_typeof(v_settings->'tiers') = 'array' then
    v_tiers := v_settings->'tiers';
  elsif jsonb_typeof(v_settings->'autoGrant') = 'object' then
    -- Хуучин хэлбэр: босгогүй бол 300k (0041-ийн анхдагч).
    v_tiers := jsonb_build_array(
      jsonb_build_object('minTotal', 300000) || (v_settings->'autoGrant'));
  else
    return null;
  end if;

  -- Хүрсэн идэвхтэй шатлалуудаас хамгийн өндөр босготой нь. Тоон талбар нь
  -- тоо биш (эвдэрсэн) мөрийг cast хийхээс өмнө шүүнэ.
  select t into v_cfg
    from jsonb_array_elements(v_tiers) t
   where jsonb_typeof(t) = 'object'
     and t->'enabled' = 'true'::jsonb
     and jsonb_typeof(t->'minTotal') = 'number'
     and jsonb_typeof(t->'value') = 'number'
     and (t->>'minTotal')::numeric > 0
     and (t->>'value')::numeric >= 1
     and (t->>'value')::numeric <= 100000000
     and (t->>'minTotal')::numeric <= v_base
     and coalesce(t->>'type', 'percent') in ('percent', 'fixed')
   order by (t->>'minTotal')::numeric desc, (t->>'value')::numeric desc
   limit 1;
  if v_cfg is null then return null; end if;

  -- Хуваалцаж болох тул нийт хязгаар = нэг хүний хязгаар (0104 §2).
  -- Тоон талбаруудыг int болгохдоо бутархай/асар том утгаар cast унахгүйн
  -- тулд numeric-ээр хавчина: энэ функц төлбөрийн trigger дотор явдаг.
  v_uses := least(greatest(coalesce(
    case when jsonb_typeof(v_cfg->'maxUsesPerUser') = 'number'
         then floor((v_cfg->>'maxUsesPerUser')::numeric) end, 1), 1), 100)::int;
  v_code := generate_coupon_code('VS');
  insert into coupons (code, user_id, source_order_id, type, value, min_subtotal,
                       max_uses, max_uses_per_user, ends_at, is_active)
  values (
    v_code, v_user, p_order,
    coalesce(v_cfg->>'type', 'percent')::coupon_type_t,
    case when coalesce(v_cfg->>'type', 'percent') = 'percent'
         then least(floor((v_cfg->>'value')::numeric), 100)::int
         else floor((v_cfg->>'value')::numeric)::int end,
    0, v_uses, v_uses,
    now() + make_interval(days => least(greatest(coalesce(
      case when jsonb_typeof(v_cfg->'validDays') = 'number'
           then floor((v_cfg->>'validDays')::numeric) end, 30), 1), 365)::int),
    true
  );
  return v_code;
end $$;
