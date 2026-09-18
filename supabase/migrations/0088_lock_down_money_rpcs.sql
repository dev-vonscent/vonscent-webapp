-- Мөнгө ба үлдэгдэл хөдөлгөдөг RPC-үүдийг PostgREST-ээс хаана.
--
-- ## Асуудал
--
-- Supabase нь `public` схемийн функц бүрийг `/rest/v1/rpc/<name>` дээр
-- `anon` ба `authenticated` рүү нээлттэй гаргадаг, учир нь Postgres-ийн
-- анхдагч `EXECUTE` эрх нь `PUBLIC`. Тайлан/хайлтын функцууд (0046, 0057,
-- 0060, 0063, 0065 …) дээр `revoke` бичигдсэн байдаг ч **захиалга, төлбөр,
-- үлдэгдлийн функцууд дээр огт байхгүй** байв.
--
-- Эдгээр нь `security definer` биш тул дуудагчийн эрхээр ажилладаг бөгөөд
-- `orders` дээр зөвхөн SELECT policy байгаа (0009) тул UPDATE-ууд нь 0 мөрд
-- нөлөөлж, халдлага бүтэхгүй байсан. Гэхдээ энэ хамгаалалт нь **санамсаргүй**:
--
--   `mark_order_paid` (0073) -ийг өөрийн захиалгынхаа id-гаар anon key-ээр
--   дуудахад функц ажиллаж эхэлнэ. `update orders set payment_status='paid'`
--   нь RLS-ээр 0 мөр хөдөлгөнө — ӨӨРӨӨР ХЭЛБЭЛ дээд талын
--   `if v_status = 'paid' then return` идемпотентын хамгаалалт хэзээ ч
--   ажиллахгүй. Дараа нь `insert into order_status_history` нь
--   "osh staff write" policy (0014) -д татгалзаж transaction унадаг учраас л
--   доорх `update profiles set pending_points = ...` хүрдэггүй — тэр нь
--   "profile self update" policy (0009) -оор ЗӨВШӨӨРӨГДӨХ байсан.
--
-- Өөрөөр хэлбэл аппликейшн ба хязгааргүй V point хэвлэх хоорондох зай нь
-- нэг функц доторх хоёр мэдэгдлийн ДАРААЛАЛ. Ирээдүйн ямар ч migration
-- тэр дарааллыг хөдөлгөвөл exploit нээгдэнэ. Дараалалд найдахаа болих.
--
-- ## Шийдэл
--
-- Эдгээр функцийг зөвхөн `service_role` (route handler-ийн admin client)
-- дуудна. Хэрэглэгчийн сесс эдгээрт хэзээ ч шууд хүрэх шаардлагагүй —
-- бүх зам `app/api/*` дундуур эрх шалгаад дамждаг.
--
-- Нэрээр нь гүйлгэж хаана: overload болон гарын үсгийн зөрүүнд тэсвэртэй
-- байхын тулд (`place_order` нь 0008 → 0015 → 0029b → 0052 гэж дөрвөн удаа
-- дахин тодорхойлогдсон).
--
-- ## Анхаар
--
-- `validate_coupon` энд ОРООГҮЙ: тэр нь зөвхөн уншиж шалгадаг, мөнгө
-- хөдөлгөдөггүй бөгөөд `/api/coupons/validate` нь admin client байхгүй үед
-- сесс рүү унадаг. Хаавал локал/демо орчинд купоны талбар чимээгүй эвдэрнэ.

do $$
declare
  v_fn text;
  v_sig text;
  -- Мөнгө, үлдэгдэл, захиалгын төлөв хөдөлгөдөг бүх функц.
  v_names text[] := array[
    'place_order',
    'mark_order_paid',
    'mark_order_refunded',
    'update_order_status',
    'reserve_inventory',
    'commit_inventory',
    'release_inventory',
    'release_expired_reserves',
    'restock_inventory',
    'release_order_points',
    'release_due_points',
    'grant_reward_coupon',
    'auto_dispatch_orders',
    'auto_deliver_orders',
    'refresh_sold_out'
  ];
begin
  foreach v_fn in array v_names loop
    for v_sig in
      select format('%I.%I(%s)', n.nspname, p.proname,
                    pg_get_function_identity_arguments(p.oid))
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_fn
    loop
      execute format(
        'revoke all on function %s from public, anon, authenticated', v_sig);
      execute format(
        'grant execute on function %s to service_role', v_sig);
      raise notice 'locked down %', v_sig;
    end loop;
  end loop;
end $$;
