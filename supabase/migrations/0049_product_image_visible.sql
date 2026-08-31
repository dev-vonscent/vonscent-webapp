-- One gallery, a selection inside it.
--
-- Until now a picture existed in `product_images` only once the admin had
-- decided to publish it: AI results lived apart, in
-- `product_image_generations.result_url`, and were *copied* across on approval.
-- That put the same picture in two shapes and left the admin choosing between
-- two lists on one screen.
--
-- Every picture — uploaded or generated — is a gallery row from here on, and
-- `is_visible` is the admin's selection of which ones the storefront shows.
--
-- Default true: every row that exists today was put there deliberately (an
-- upload, or an AI result the admin approved), so the backfill must not hide
-- any of them. Newly generated images are inserted with is_visible = false —
-- they still need a human to pick them.

alter table product_images
  add column if not exists is_visible boolean not null default true;

-- The storefront always reads "visible images of this product, in order".
create index if not exists product_images_visible_idx
  on product_images (product_id, is_visible, sort_order);
