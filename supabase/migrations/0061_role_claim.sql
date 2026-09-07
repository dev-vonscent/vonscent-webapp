-- `profiles.role`-ыг JWT-д тусгах (алдагдсан 0054_role_in_jwt.sql-ийг сэргээв).
--
-- Санд энэ механизм АЖИЛЛАЖ БАЙСАН (`_app_migrations` дотор 0054_role_in_jwt.sql
-- бүртгэлтэй) атлаа файл нь репод байхгүй болсон тул шинэ сан дээр огт үүсэхгүй
-- байв. Одоо код нь энэ claim дээр тулгуурладаг болсон учир (middleware) файлыг
-- нь эргүүлэн бичив — идемпотент, одоо байгаа сан дээр юу ч өөрчлөхгүй.
--
-- Яагаад хэрэгтэй вэ: админы зам бүр дээр middleware эрхийг шалгадаг. Түүнийг
-- `profiles`-оос уншвал хүсэлт БҮРД өгөгдлийн сан руу нэмэлт дуудлага явна —
-- зурагдалт эхлэхийн ӨМНӨ, дараалж. JWT дотор байвал тэр дуудлага бүр мөсөн
-- алга болно.
--
-- Аюулгүй байдал: JWT нь эрх солигдоход ШУУД шинэчлэгддэггүй (токен сэргээгдэх
-- хүртэл хуучин утгаа хадгална). Тиймээс энэ claim нь ЗӨВХӨН чиглүүлэлтийн
-- хаалга; жинхэнэ шалгалт нь RLS (`current_role_name()` нь `profiles`-оос
-- уншсан хэвээр) ба route handler бүр доторх `getStaffUser()` хоёрт үлдэнэ.

create or replace function sync_role_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('user_role', new.role::text)
   where id = new.id;
  return new;
end $$;

drop trigger if exists profiles_role_claim on public.profiles;
create trigger profiles_role_claim
  after insert or update of role on public.profiles
  for each row execute function sync_role_claim();

-- Одоо байгаа хэрэглэгчдийн claim-ыг нөхнө (аль хэдийн зөв бол хөдлөхгүй).
update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('user_role', p.role::text)
  from public.profiles p
 where p.id = u.id
   and coalesce(u.raw_app_meta_data ->> 'user_role', '') <> p.role::text;
