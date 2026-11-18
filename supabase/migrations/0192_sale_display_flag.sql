-- Хямдралын харагдац (task 2.1, 2.2): нүүрний «Хямдралтай» rail ба барааны
-- картын хямдрал дуусах тоолуур. Feature flag `sale_display`.
--
-- Зөвхөн туг: rail ба тоолуур нь одоо байгаа өгөгдлийг (`product_variants`,
-- `variant_price`, `live_sale_events`) уншина — шинэ хүснэгт, trigger,
-- pg_cron байхгүй тул туг хаалттай үед санд юу ч хуримтлагдахгүй.
--
-- Expand only.

insert into feature_flags (key) values ('sale_display') on conflict do nothing;
