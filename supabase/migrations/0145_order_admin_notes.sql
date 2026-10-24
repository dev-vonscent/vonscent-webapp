-- Захиалга дээрх админы дотоод тэмдэглэл (клиент, 2026-10): «чатаар хороогоо
-- зассан», «өөр дугаар дээр хүлээж авна» гэх мэт.
--
-- `orders`-т багана болгохгүй: "order owner read" (0009) нь захиалгын эзэнд
-- мөрийг бүхэлд нь уншуулдаг тул тэмдэглэл хэрэглэгчид харагдана. Тусдаа
-- хүснэгт, зөвхөн ажилтан унших/бичих. Захиалга бүрд нэг тэмдэглэл —
-- засварлаж болно, хоосон бол мөр устна.

create table if not exists order_admin_notes (
  order_id   uuid primary key references orders(id) on delete cascade,
  note       text not null check (char_length(note) between 1 and 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

alter table order_admin_notes enable row level security;

drop policy if exists "order_admin_notes staff" on order_admin_notes;
create policy "order_admin_notes staff" on order_admin_notes for all
  using (is_staff())
  with check (is_staff());

revoke all on order_admin_notes from anon;
