-- Phone + passcode auth on top of verify.mn (development.md §9.1).
-- A VERIFIED session is consumed exactly once by register / passcode reset.
alter table verify_mn_sessions
  add column if not exists consumed boolean not null default false;

-- Login brute-force guard: a 4-digit passcode needs server-side lockout.
create table if not exists phone_login_attempts (
  phone text primary key,
  attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Service-role only, same as verify_mn_sessions.
alter table phone_login_attempts enable row level security;
