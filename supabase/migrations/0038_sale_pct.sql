-- Display-only discount percent (UX: a "Хямдрал" badge with no anchor price
-- reads as noise). Variant prices remain the charged figure everywhere —
-- sale_pct only lets the storefront compute the crossed-out "original".
alter table public.products
  add column if not exists sale_pct integer not null default 0;

do $$
begin
  alter table public.products
    add constraint products_sale_pct_range check (sale_pct >= 0 and sale_pct <= 100);
exception
  when duplicate_object then null;
end $$;
