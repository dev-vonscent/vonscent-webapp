-- Сэтгэгдэл цуцлахад «Бусад» шалтгааныг админ өөрөө бичнэ (feature flag
-- `review_moderation`, 0162-ийн өргөтгөл).
--
-- Expand only: nullable нэг багана. Хуучин код энэ баганыг мэдэхгүй хэвээр
-- ажиллана — `reject_reason` (код) нь өөрчлөгдөхгүй, тэмдэглэл нь нэмэлт.

alter table reviews
  add column if not exists reject_note text;

do $$
begin
  alter table reviews
    add constraint reviews_reject_note_len
    check (reject_note is null or char_length(reject_note) <= 300);
exception
  when duplicate_object then null;
end $$;

-- 0162-ийн guard — хэрэглэгч шинэ сэтгэгдэлдээ тэмдэглэл оруулж чадахгүй.
create or replace function reviews_moderation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if not feature_enabled('review_moderation') then
    return new;
  end if;
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if is_staff() then
      return new;
    end if;
    raise exception 'REVIEW_LOCKED' using errcode = '42501';
  end if;

  v_reason := review_block_reason(new.user_id, new.product_id, new.collection_id);
  if v_reason is not null then
    raise exception 'REVIEW_BLOCKED:%', v_reason using errcode = '42501';
  end if;

  if length(regexp_replace(coalesce(new.body, ''), '\s', '', 'g')) < 100 then
    raise exception 'REVIEW_TOO_SHORT' using errcode = '23514';
  end if;

  new.status := 'pending';
  new.reject_reason := null;
  new.reject_note := null;
  new.is_visible := true;
  new.is_featured := false;
  new.moderated_at := null;
  new.moderated_by := null;
  return new;
end;
$$;
