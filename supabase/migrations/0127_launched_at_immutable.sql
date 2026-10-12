-- launched_at: caller огт бичиж чадахгүй.
--
-- 0125 нь зөвхөн БӨГЛӨГДСӨН `launched_at`-ийг хамгаалдаг байсан — хоосон
-- (хэзээ ч гараагүй) бараанд дурын огноо урьдчилан бичиж болно. Тэр огноо
-- дараа нь «гарсан» гэж тооцогдож, «Шинэ» эрэмбийг эвдээд, өөрчлөгдөхгүй
-- болно. Одоо:
--   INSERT-д launched_at өгсөн          → LAUNCHED_AT_IMMUTABLE
--   UPDATE-д launched_at-ийг өөрчилсөн → LAUNCHED_AT_IMMUTABLE
--                                         (null → утга, утга → өөр, утга → null)
-- Бөглөх нь зөвхөн энэ trigger-ийн ажил: анх `active` болох үед.
--
-- 0125-ын backfill нь trigger үүсэхээс өмнө ажилладаг тул үүнд хамаарахгүй.
-- 0125 dev санд аль хэдийн хэрэгжсэн тул тэр файлыг засаагүй (0126-тай
-- ижил шалтгаан). Бие нь 0125-ынх, зөвхөн launched_at-ийн хоёр шалгалт
-- өөрчлөгдсөн. `create or replace` тул trigger хэвээр.
create or replace function products_status_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.launched_at is not null then
      raise exception 'LAUNCHED_AT_IMMUTABLE'
        using errcode = 'check_violation';
    end if;
    if new.status is null and new.is_active is null then
      new.status := 'active';
    elsif new.status is null then
      new.status := case when new.is_active then 'active'::product_status_t
                         else 'hidden'::product_status_t end;
    end if;
    if new.is_active is null then
      new.is_active := new.status = 'active';
    elsif new.is_active is distinct from (new.status = 'active') then
      raise exception 'STATUS_ACTIVE_MISMATCH'
        using errcode = 'check_violation';
    end if;
    if new.status = 'active' and new.launched_at is null then
      -- Импорт, clone нь түүхэн `created_at`-тай мөр оруулдаг — тэр мөч нь
      -- бодит нийтлэгдсэн огноонд хамгийн ойр.
      new.launched_at := coalesce(new.created_at, now());
    end if;
  else
    if new.launched_at is distinct from old.launched_at then
      raise exception 'LAUNCHED_AT_IMMUTABLE'
        using errcode = 'check_violation';
    end if;
    if new.status is distinct from old.status
       and new.is_active is not distinct from old.is_active then
      new.is_active := new.status = 'active';
    elsif new.is_active is distinct from old.is_active
          and new.status is not distinct from old.status then
      new.status := case when new.is_active then 'active'::product_status_t
                         else 'hidden'::product_status_t end;
    elsif new.is_active is distinct from (new.status = 'active') then
      raise exception 'STATUS_ACTIVE_MISMATCH'
        using errcode = 'check_violation';
    end if;
    if new.status = 'active' and new.launched_at is null then
      new.launched_at := now();
    end if;
  end if;

  if new.status = 'coming_soon' and new.launched_at is not null then
    raise exception 'ALREADY_LAUNCHED'
      using errcode = 'check_violation';
  end if;
  -- Ойролцоо хугацаа нь зөвхөн «Тун удахгүй» үед утгатай. Худалдаанд гарсны
  -- дараа үлдвэл хуучирсан огноо хаа нэгтээ дахин гарч ирэх эрсдэлтэй.
  if new.status = 'active' then
    new.coming_soon_note := null;
  end if;
  new.coming_soon_note := nullif(btrim(coalesce(new.coming_soon_note, '')), '');
  return new;
end;
$$;
