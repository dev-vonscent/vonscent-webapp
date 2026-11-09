-- «Миний мэдээлэл» (feature flag `profile_info`): хэрэглэгч өөрийн
-- мэдээллийг бөглөж, бүрэн болгосон үед НЭГ удаа V point авна.
--
-- Expand only: profiles-д nullable багана, шинэ guard table, шинэ RPC.
-- Хуучин код эдгээрийг мэдэхгүй хэвээр ажиллана.
--
-- «Бүрэн» гэдэг нь (`profile_info_complete`, src/features/profile-info/lib.ts
-- -ийн `PROFILE_INFO_FIELDS`-тэй таарах ёстой):
--   зураг · нэр · баталгаажсан утас · идэвхтэй имэйл (newsletter_subscribers)
--   · хүйс · төрсөн өдөр · ажил · хүргэлтийн хаяг (≥1) · дуртай үнэрийн
--   төрөл (≥1) · дуртай үнэртэн (1–3).
--
-- Урамшууллын хэмжээ `settings.loyalty.profilePoints` (админ тохируулна,
-- 0 бол унтарна).

insert into feature_flags (key) values ('profile_info') on conflict do nothing;

alter table profiles
  add column if not exists gender text
    check (gender in ('male', 'female', 'other')),
  add column if not exists birthday date
    check (birthday >= date '1900-01-01'),
  add column if not exists job text
    check (char_length(job) <= 80),
  add column if not exists scent_preferences text[]
    check (cardinality(scent_preferences) <= 10),
  add column if not exists favorite_perfumes text[]
    check (cardinality(favorite_perfumes) <= 3);

update settings
  set value = value || jsonb_build_object('profilePoints', 500)
  where key = 'loyalty' and not (value ? 'profilePoints');

-- Нэг хэрэглэгчид нэг л удаа — мэдээллээ устгаад дахин бөглөх нь дахин
-- оноо авчрахгүй.
create table if not exists profile_rewards (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  points     int  not null,
  created_at timestamptz not null default now()
);

alter table profile_rewards enable row level security;
drop policy if exists "profile_rewards owner read" on profile_rewards;
create policy "profile_rewards owner read" on profile_rewards for select
  using (user_id = auth.uid() or is_staff());
-- Бичилт зөвхөн доорх security definer функцээр.

/** Хэрэглэгчийн мэдээлэл бүрэн эсэх — урамшуулал олгох нөхцөл. */
create or replace function profile_info_complete(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles p
     where p.id = p_user
       and coalesce(btrim(p.avatar_url), '') <> ''
       and coalesce(btrim(p.full_name), '') <> ''
       and p.phone_verified
       and p.gender is not null
       and p.birthday is not null
       and coalesce(btrim(p.job), '') <> ''
       and coalesce(cardinality(p.scent_preferences), 0) >= 1
       and coalesce(cardinality(p.favorite_perfumes), 0) >= 1
       and exists (
         select 1 from newsletter_subscribers n
          where n.user_id = p_user and n.is_active
       )
       and exists (select 1 from addresses a where a.user_id = p_user)
  );
$$;

revoke all on function profile_info_complete(uuid)
  from public, anon, authenticated;

/**
 * Мэдээлэл бүрэн бол урамшууллыг олгоно. Туг хаалттай, тохиргоо 0, бүрэн
 * биш, эсвэл аль хэдийн авсан бол юу ч хийхгүй — 0 буцаана. Route нь
 * нэвтэрсэн хэрэглэгчийн id-г дамжуулна (service_role).
 */
create or replace function claim_profile_reward(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
begin
  if p_user is null or not feature_enabled('profile_info') then
    return 0;
  end if;

  select coalesce((value->>'profilePoints')::int, 0) into v_points
    from settings where key = 'loyalty';
  if coalesce(v_points, 0) <= 0 then
    return 0;
  end if;

  if not profile_info_complete(p_user) then
    return 0;
  end if;

  insert into profile_rewards (user_id, points)
    values (p_user, v_points)
    on conflict do nothing;
  if not found then
    return 0;
  end if;

  update profiles set loyalty_points = loyalty_points + v_points
    where id = p_user;
  insert into loyalty_ledger (user_id, delta, reason)
    values (p_user, v_points, 'profile');
  return v_points;
end;
$$;

revoke all on function claim_profile_reward(uuid)
  from public, anon, authenticated;
grant execute on function claim_profile_reward(uuid) to service_role;
grant execute on function profile_info_complete(uuid) to service_role;
