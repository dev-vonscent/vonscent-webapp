-- Имэйл бүртгэлийг данстай хэрэглэгчид хатуу холбоно (client-ийн шийдвэр):
--   * зөвхөн нэвтэрсэн хэрэглэгч имэйлээ бүртгүүлнэ (route талд шалгана,
--     RLS-ийн anonymous insert-ийг хаана);
--   * захиалга баталгаажих/цуцлагдах имэйл энэ бүртгэлтэй хаяг руу очно;
--   * имэйл доторх token линкээр unsubscribe хийнэ.

alter table newsletter_subscribers
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists token uuid not null default gen_random_uuid(),
  add column if not exists is_active boolean not null default true;

-- One registered email per account (legacy anonymous rows keep user_id null).
create unique index if not exists newsletter_subscribers_user_idx
  on newsletter_subscribers (user_id) where user_id is not null;
create unique index if not exists newsletter_subscribers_token_idx
  on newsletter_subscribers (token);

-- Registration now requires an account: the service-role API route is the
-- only writer, so anonymous inserts are closed off.
drop policy if exists "newsletter insert" on newsletter_subscribers;
