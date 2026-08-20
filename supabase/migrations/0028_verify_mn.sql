-- verify.mn MO-SMS phone verification sessions (user texts a one-time code to
-- shortcode 144773; verify.mn pings our callback, we re-check and record).
create table if not exists verify_mn_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  callback_token text not null unique,
  phone text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VERIFIED', 'EXPIRED')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verify_mn_sessions_phone_idx
  on verify_mn_sessions (phone, created_at desc);

-- Service-role only (no policies): sessions are written and read exclusively
-- by route handlers through the admin client.
alter table verify_mn_sessions enable row level security;
