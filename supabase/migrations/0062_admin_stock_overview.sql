-- Хяналтын самбар / тайлангийн үлдэгдлийн тоог өгөгдлийн сан руу зөөх.
--
-- Өмнөх байдал: `/admin`, `/admin/reports`, `/admin/reports/print` гурвуулаа
-- `getAdminProducts()`-оор БҮХ барааг (зураг, хэмжээ, таг, AI-зургийн түүхтэй
-- нь) татаж аваад JS дотор count / sum / sort хийдэг байв. Гурвуулаа үнэн
-- хэрэгтээ ижил асуулт асууж байсан: «үлдэгдэл нь хамгийн бага бараанууд аль
-- нь вэ, тэдгээр нь хэд вэ».
--
-- Одоо нэг дуудлага: тоонууд SQL-д, жагсаалт нь зөвхөн p_limit мөр.
--
-- Төлвийн дүрэм нь `src/features/admin/lib/stock-state.ts`-тэй ижил байх ёстой:
-- 0-оос доош = дууссан, босгондоо хүрсэн нь аль хэдийн бага.
--
-- SECURITY INVOKER: RLS хэвээр — нуусан бараа зөвхөн ажилтанд тоологдоно.

create or replace function admin_stock_overview(p_limit int default 50)
returns table (
  total_products     bigint,
  low_count          bigint,
  soldout_count      bigint,
  total_available_ml bigint,
  -- Үлдэгдэл багаас нь эрэмбэлсэн p_limit мөр. Гурван хуудас үүнээс өөр өөр
  -- хэсгийг шүүж авна (самбар: зөвхөн «бага»; тайлан: эхний 10 идэвхтэй;
  -- хэвлэх: «ok» биш бүгд).
  items              jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  with s as (
    select
      pr.id, pr.name, pr.brand, pr.is_active,
      coalesce(inv.available_ml, 0) as available_ml,
      -- 0048-ын өгөгдмөл (DEFAULT_LOW_STOCK_ML = 50).
      coalesce(inv.low_stock_ml, 50) as low_stock_ml,
      case
        when coalesce(inv.available_ml, 0) <= 0 then 'soldout'
        when coalesce(inv.available_ml, 0) <= coalesce(inv.low_stock_ml, 50) then 'low'
        else 'ok'
      end as state
    from products pr
    left join inventory inv on inv.product_id = pr.id
  )
  select
    (select count(*) from s),
    (select count(*) from s where state = 'low'),
    (select count(*) from s where state = 'soldout'),
    (select coalesce(sum(available_ml), 0)::bigint from s),
    coalesce((
      select jsonb_agg(to_jsonb(x) order by x.available_ml, x.name)
        from (
          select id, name, brand, is_active, available_ml, low_stock_ml, state
            from s
           order by available_ml, name
           limit greatest(coalesce(p_limit, 50), 1)
        ) x
    ), '[]'::jsonb);
$$;

comment on function admin_stock_overview is
  'Үлдэгдлийн нэгдсэн тойм: нийт/бага/дууссан тоо, нийт мл, ба үлдэгдэл багатай '
  'эхний p_limit бараа. stock-state.ts-ийн дүрмийг давтана.';

revoke all on function admin_stock_overview(int) from public;
revoke execute on function admin_stock_overview(int) from anon;
grant execute on function admin_stock_overview(int) to authenticated;
