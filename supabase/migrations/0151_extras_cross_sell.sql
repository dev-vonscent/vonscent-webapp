-- Нэмэлт бараа — cross-sell (extras-shop-plan §9; PR8). Feature flag:
-- `extras_shop`.
--
-- Expand only: нүүрний хэсгийн шинэ төрөл 'extras' (check өргөсөв — хуучин
-- код энэ төрлийг үүсгэдэггүй), барааны хуудасны «Энэ үнэрийн үлдэгдэлтэй
-- шил байна»-д тухайн үнэртний зарагдаж буй шил.

alter table home_sections drop constraint if exists home_sections_kind_check;
alter table home_sections
  add constraint home_sections_kind_check
  check (kind in ('manual', 'tag', 'featured', 'extras'));

-- Үнэртний зарагдаж буй (listed) үлдэгдэлтэй шил — туг хаалттай бол хоосон.
create or replace function extras_leftover_for(p_product uuid)
returns table (slug text, name text, remaining_ml int, full_ml int, price int)
language sql stable security definer set search_path = public as $$
  select e.slug, e.name, e.remaining_ml, e.full_ml, e.from_price
    from extras_catalog() e
    join extra_products p on p.id = e.id
   where p.product_id = p_product
     and e.mode = 'leftover_liquid'
     and not e.sold_out
   order by e.remaining_ml desc;
$$;

revoke all on function extras_leftover_for(uuid) from public;
grant execute on function extras_leftover_for(uuid) to anon, authenticated, service_role;
