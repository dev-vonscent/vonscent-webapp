-- Persist the reference image the admin uploads when creating an AI product
-- (ai-image-generation §5). Kept on the product itself — independent of the
-- generation-job history — so every future regeneration can work from the
-- original bottle even after jobs are pruned.
alter table products add column if not exists reference_image_url text;
