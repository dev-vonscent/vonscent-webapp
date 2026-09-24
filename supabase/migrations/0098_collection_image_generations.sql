-- AI-аар багцын poster зураг үүсгэх ажлууд (админы багц засах хуудас).
--
-- `product_image_generations` (0030a)-ийн ихэр: нэг мөр = нэг оролдлого,
-- багц бүр түүхээ хадгалж, админ аль үр дүнг нь ашиглахаа сонгоно. Үр дүн
-- `collections.image_url`-д автоматаар ОРОХГҮЙ — админ «Ашиглах» дараад
-- формоо хадгалсан үед л солигдоно.
--
-- Лавлах нь нэг биш, багцын гишүүн бүрийн үндсэн зураг (дөрөв) тул массив.

create table if not exists collection_image_generations (
  id             uuid primary key default gen_random_uuid(),
  collection_id  uuid not null references collections(id) on delete cascade,
  status         image_gen_status_t not null default 'pending',
  prompt         text not null default '',
  reference_urls text[] not null default '{}',
  result_url     text,
  error          text,
  attempts       int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cig_collection_idx
  on collection_image_generations (collection_id, created_at desc);

drop trigger if exists cig_updated_at on collection_image_generations;
create trigger cig_updated_at before update on collection_image_generations
  for each row execute function set_updated_at();

-- Зөвхөн ажилтан; дэлгүүр энэ хүснэгтийг уншдаггүй. Route handler-ууд
-- service-role client ашигладаг — энэ нь давхар хамгаалалт.
alter table collection_image_generations enable row level security;
drop policy if exists "cig staff all" on collection_image_generations;
create policy "cig staff all" on collection_image_generations for all
  using (is_staff()) with check (is_staff());
