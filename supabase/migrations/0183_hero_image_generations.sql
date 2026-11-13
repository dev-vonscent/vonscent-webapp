-- Hero-гийн зургийг AI-аар (gpt-image-2) үүсгэх ажлууд (plan §4.6, §8).
-- Feature flag `hero_admin` (0182) — тусдаа туг шаардлагагүй: hero засварын
-- нэг хэсэг.
--
-- `collection_image_generations` (0098)-ийн ихэр: нэг мөр = нэг оролдлого,
-- админ хувилбаруудаас нүдээр шалгаж НЭГИЙГ сонгоно («Ашиглах»). Үр дүн hero-д
-- автоматаар ОРОХГҮЙ — сонгоод hero-гоо хадгалсан үед л нүүрэнд гарна.
--
-- `result_url` — lossless PNG мастер (storage `hero/<group>/gen-<id>.png`).
-- «Ашиглах» үед л 1600/2400/3200 webp болно (0182-ийн upload-тай нэг алхам).
--
-- `group_id` — hero-гийн зургийн хавтас: хадгалсан hero-д id нь, шинэ
-- (хадгалаагүй) hero-д маягтын client uuid. Тиймээс hero хадгалахаас өмнө
-- үүсгэж болно; `hero_id` нь лавлагаа (hero устахад null).
--
-- Expand only: шинэ хүснэгт.

create table if not exists hero_image_generations (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null,
  hero_id        uuid references heroes(id) on delete set null,
  target         text not null check (target in ('desktop', 'mobile')),
  theme_key      text not null check (theme_key ~ '^[a-z_]{2,30}$'),
  theme_extra    text not null default '' check (length(theme_extra) <= 500),
  size           text not null check (size ~ '^[0-9]{3,4}x[0-9]{3,4}$'),
  prompt         text not null,
  reference_urls text[] not null default '{}',
  status         image_gen_status_t not null default 'pending',
  result_url     text,
  error          text,
  attempts       int not null default 0,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists hig_group_idx
  on hero_image_generations (group_id, created_at desc);
-- Өдрийн хязгаар (route): сүүлийн 24 цагийн тоо.
create index if not exists hig_created_idx
  on hero_image_generations (created_at desc);

drop trigger if exists hig_updated_at on hero_image_generations;
create trigger hig_updated_at before update on hero_image_generations
  for each row execute function set_updated_at();

-- Туг хаалттай үед шинэ ажил үүсэхгүй (prod-д зардал, өгөгдөл хуримтлагдахгүй).
-- Явж буй ажлын төлөв шинэчлэгдэх (update) нь хаагдахгүй.
create or replace function hero_image_generations_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not feature_enabled('hero_admin') then
    raise exception 'FEATURE_DISABLED';
  end if;
  return new;
end $$;

drop trigger if exists hig_feature_guard on hero_image_generations;
create trigger hig_feature_guard
  before insert on hero_image_generations
  for each row execute function hero_image_generations_guard();

-- Зөвхөн staff уншина; бичилт service-role (route handler + `after()`).
alter table hero_image_generations enable row level security;
drop policy if exists "hig staff read" on hero_image_generations;
create policy "hig staff read" on hero_image_generations
  for select using (is_staff());

comment on table hero_image_generations is
  'Hero-гийн AI зураг (0183): оролдлого бүр мөр, админ нэгийг сонгоно. '
  'result_url = PNG мастер. Туг hero_admin хаалттай бол insert хориотой.';
