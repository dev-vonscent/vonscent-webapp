-- Буцаалтын данс (клиент, 2026-09-30).
--
-- Хэрэглэгч төлсөн захиалгаа цуцлахад мөнгийг хаашаа буцаахыг ӨӨРӨӨ
-- бичнэ — QPay нь зөвхөн картын гүйлгээг буцаадаг тул бусад төлбөрийг админ
-- гараар шилжүүлдэг, харин данс нь урьд DM-ээр л ирдэг байв.
--
-- Тусдаа хүснэгт, `orders`-ийн багана биш: санхүүгийн мэдээлэл тул зөвхөн
-- буцаалт хийгдэх хүртэл амьдарна — админ «Буцаалт хийх» дармагц route нь
-- мөрийг устгана (`/api/admin/orders/[id]/status`). Захиалга бүрт нэг л данс
-- (PK = order_id).
--
-- Бичих эрх хэрэглэгчид байхгүй: цуцлах route нь өмчлөл, төлөв, schema-г
-- шалгаад service_role-оор бичнэ. Эзэн нь өөрийн мөрийг (захиалгын
-- хуудсанд «хаашаа буцаах вэ») уншина, ажилтан бүгдийг.
--
-- Буцаах дүнг хадгалахгүй: `orders.total`-оос `refundBreakdown()`
-- (src/lib/refund.ts, 1%) бодогдоно — хувь өөрчлөгдвөл хуучин мөр худал
-- болохгүй.

create table if not exists order_refund_accounts (
  order_id       uuid primary key references orders(id) on delete cascade,
  bank           text not null check (length(bank) between 2 and 100),
  account_number text not null check (account_number ~ '^(MN[0-9]{18}|[0-9]{8,18})$'),
  holder_name    text not null check (length(holder_name) between 2 and 100),
  created_at     timestamptz not null default now()
);

alter table order_refund_accounts enable row level security;

drop policy if exists "refund account owner read" on order_refund_accounts;
create policy "refund account owner read" on order_refund_accounts
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_id and (o.user_id = auth.uid() or is_staff())
    )
  );

drop policy if exists "refund account staff" on order_refund_accounts;
create policy "refund account staff" on order_refund_accounts
  for all using (is_staff()) with check (is_staff());

comment on table order_refund_accounts is
  'Хэрэглэгчийн цуцалсан, төлсөн захиалгын буцаалтын данс. Буцаалт хийгдмэгц устгагдана.';
