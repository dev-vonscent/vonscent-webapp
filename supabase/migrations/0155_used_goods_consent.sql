-- Хэрэглэсэн барааны зөвшөөрөл — checkout (extras-shop-plan §18.5; PR14).
-- Feature flag: `extras_shop` (нэмэлт барааны мөр туг хаалттай үед үүсдэггүй).
--
-- Хоосон шил, үлдэгдэлтэй шил (`extra_category_modes.requires_consent`, 0153)
-- сагсанд байвал хэрэглэгч «Хэрэглэсэн бараа гэдгийг ойлгож, нөхцөлийг
-- зөвшөөрч байна»-г заавал чеклэнэ. Client, Zod, энд — гурвуулаа шалгана.
--
-- `place_order(jsonb, jsonb)`-ийн SIGNATURE ӨӨРЧЛӨГДӨХГҮЙ (§18.7 PR14):
-- зөвшөөрөл нь `p_order.used_goods_consent` (optional) талбараар ирнэ —
-- 0149-ийн `p_order.expected`-тэй ижил. `db:migrate-prod` merge-ээс өмнө
-- ажилладаг тул prod-ийн хуучин код энэ функцийг дуудсаар байна; хуучин
-- хүсэлтэд зөвшөөрөл шаардах мөр байхгүй тул нөлөөгүй.
--
-- 0149-ийн 600 мөрт биеийг хуулахгүйн тулд: түүнийг `place_order_core` гэж
-- нэрийг сольж (эрх нь хамт шилжинэ), ижил signature-тэй нимгэн wrapper
-- зөвшөөрлийг шалгаад core-г дуудна.
--
-- ⚠ Цаашид захиалгын логикийг засахдаа `place_order_core`-г засна.
-- `create or replace function place_order` нь энэ wrapper-ийг дарж,
-- зөвшөөрлийн шалгалтыг чимээгүй алдагдуулна (scripts/test-extras.ts
-- «v5: хэрэглэсэн барааны зөвшөөрөл» сценари үүнийг барина).

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'place_order_core') then
    alter function place_order(jsonb, jsonb) rename to place_order_core;
  end if;
end $$;

comment on function place_order_core(jsonb, jsonb) is
  'Захиалга үүсгэх бие (0149). Шууд бүү дууд — place_order wrapper (0155) '
  'хэрэглэсэн барааны зөвшөөрлийг шалгадаг.';

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_needs boolean;
  v_result jsonb;
begin
  -- Сагсанд зөвшөөрөл шаардах горимын (хоосон шил, үлдэгдэлтэй шил) бараа?
  select exists (
    select 1
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
      join extra_variants v
        on v.id = nullif(i->>'extra_variant_id', '')::uuid
      join extra_products p on p.id = v.extra_id
      join extra_category_modes m
        on m.category_id = p.category_id
       and m.inventory_mode = p.inventory_mode
     where m.requires_consent
  ) into v_needs;

  if v_needs and not coalesce((p_order->>'used_goods_consent')::boolean, false) then
    raise exception 'USED_GOODS_CONSENT_REQUIRED' using errcode = 'check_violation';
  end if;

  v_result := place_order_core(p_order, p_items);

  if v_needs then
    update orders set used_goods_consent_at = coalesce(used_goods_consent_at, now())
     where id = (v_result->>'order_id')::uuid;
  end if;
  return v_result;
end $$;

comment on function place_order(jsonb, jsonb) is
  'Захиалга үүсгэх (0155 wrapper): хэрэглэсэн барааны зөвшөөрлийг шалгаад '
  'place_order_core (0149)-г дуудна. Хариу = order_summary().';

revoke all on function place_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;
revoke all on function place_order_core(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order_core(jsonb, jsonb) to service_role;
