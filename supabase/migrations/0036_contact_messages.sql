-- Contact form messages: stored first (nothing gets lost), then forwarded to
-- the store inbox by email when RESEND_API_KEY is configured (questions.md
-- №24 — vonscent.store@gmail.com).

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

-- Inserts go through the API (service role); staff may read them in place of
-- / alongside the email copy.
drop policy if exists "staff read contact messages" on contact_messages;
create policy "staff read contact messages" on contact_messages
  for select using (is_staff());
