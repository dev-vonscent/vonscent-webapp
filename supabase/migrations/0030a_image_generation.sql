-- AI product-image generation jobs (ai-image-generation-requirement.md §5).
--
-- One row per generation attempt; a product keeps its history (created_at desc)
-- so the admin can revert to an earlier result. The "current" AI image is the
-- latest `done` row; on approval it is copied into product_images (sort_order 0)
-- so the storefront is unchanged.

do $$ begin
  create type image_gen_status_t as enum ('pending','generating','done','failed');
exception when duplicate_object then null; end $$;

create table if not exists product_image_generations (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  status        image_gen_status_t not null default 'pending',
  prompt        text not null default '',
  reference_url text,                 -- admin's uploaded reference image
  result_url    text,                 -- generated image public URL
  error         text,                 -- failure reason
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists pig_product_idx
  on product_image_generations (product_id, created_at desc);

drop trigger if exists pig_updated_at on product_image_generations;
create trigger pig_updated_at before update on product_image_generations
  for each row execute function set_updated_at();

-- Staff-only; the storefront never reads generation jobs. Route handlers use the
-- service-role client (bypasses RLS) — this is defense in depth.
alter table product_image_generations enable row level security;
drop policy if exists "pig staff all" on product_image_generations;
create policy "pig staff all" on product_image_generations for all
  using (is_staff()) with check (is_staff());

-- Admin-tunable generation settings (§11).
insert into settings (key, value) values
  ('imageGen', jsonb_build_object(
     'enabled', true,
     'basePrompt', 'Minimalist product photograph with the perfume bottle as the only hero subject. Do NOT depict, illustrate or scatter the fragrance''s notes or ingredients. Instead, interpret the perfume''s character and mood from the description below and express it through one restrained, minimal scene: a fitting colour palette, a single simple surface or material, and matching light — few or no props, generous negative space, the bottle sharp and well placed. (For example, a bold, confident scent could rest on dark grey stone in a dark grey palette.) Photorealistic, elegant, editorial, high detail, sharp focus, no text, no watermark.',
     'size', '1024x1536',
     'quality', 'medium',
     'autoOnCreate', true,
     'maxAttempts', 1
   ))
on conflict (key) do nothing;
