-- Захиалгыг бэлдсэн эсэх (грамлаж, уутлаж савласан) — админы «Захиалга»
-- хүснэгтийн checkbox.
--
-- Шинэ `order_status_t` утга БИШ, тусдаа багана: бэлдэлт нь «Баталгаажсан»
-- дотрох дэд алхам бөгөөд хэрэглэгчид харагддаг төлөв, cron-ийн авто шилжилт,
-- `update_order_status`-ийн дүрмийг хөндөх шаардлагагүй. NULL = бэлдэгдээгүй.
-- Нэг мөрийн нэг UPDATE тул RPC хэрэггүй.

alter table orders
  add column if not exists prepared_at timestamptz,
  add column if not exists prepared_by uuid references profiles(id) on delete set null;

comment on column orders.prepared_at is
  'Ажилтан захиалгыг бэлдсэн (грамлаж, уутласан) цаг. NULL = бэлдэгдээгүй.';

-- «Бэлдэгдээгүй» шүүлт: баталгаажсан боловч бэлдээгүй захиалга.
create index if not exists orders_unprepared_idx
  on orders (created_at desc)
  where status = 'confirmed' and prepared_at is null;
