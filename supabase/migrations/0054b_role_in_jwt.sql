-- Хэрэглэгчийн эрхийг JWT дотор авч явах (админы навигацийн саатал).
--
-- Асуудал: `/admin` рүү орох хүсэлт бүр — RSC навигаци бүрийг оруулаад —
-- middleware дотор хоёр сүлжээний дуудлага төлдөг байв:
--   1. `auth.getUser()` — JWT-г Auth сервер дээр баталгаажуулна;
--   2. `profiles.role` уншилт — ажилтан мөн эсэхийг шалгана (152-427мс).
-- Хоёул хуудсын `loading.tsx` гарахаас **өмнө** дуусах ёстой тул дарах бүрт
-- хагас секунд орчим хуучин дэлгэц хөшдөг байсан.
--
-- Шийдэл: эрхийг `auth.users.raw_app_meta_data` руу тусгана. Supabase энэ
-- талбарыг access token-ий `app_metadata` claim болгон **автоматаар** оруулдаг
-- тул middleware эрхийг токеноос уншиж, DB рүү огт очихгүй. Төсөл нь ES256
-- (asymmetric) түлхүүр ашигладаг болохоор `getClaims()` нь гарын үсгийг
-- WebCrypto-гоор нутагт шалгана — өөрөөр хэлбэл §1 ч сүлжээгүй болно.
--
-- `app_metadata` нь зөвхөн сервер талаас бичигддэг (хэрэглэгч засаж чадахгүй),
-- тиймээс эрхийн мэдээлэл байрлуулах зөв газар нь энэ.
--
-- ⚠️ Эрх өөрчлөгдөхөд шинэ утга нь токен сэргэх үед (ихэвчлэн 1 цаг) хүчинтэй
-- болно. Тэр цонхонд middleware хуучин эрхийг харна — гэхдээ **өгөгдөл нээгдэх
-- газар нь энэ биш**: RLS-ийн `is_staff()` ба route handler бүрийн
-- `getStaffUser()` аль аль нь `profiles`-ыг шууд уншсаар байна. Өөрөөр хэлбэл
-- эрх нь хураагдсан хүн админы бүрхүүлийг хармаар атлаа ямар ч мөр авахгүй.

-- ── 1. profiles.role → auth.users.raw_app_meta_data.user_role ──────────
--
-- Нэр нь `user_role`: токен дотор `role` гэсэн дээд түвшний claim аль хэдийн
-- байгаа (PostgREST түүгээр Postgres-ийн role-ыг сонгодог), түүнтэй андуурч
-- болохгүй.
create or replace function sync_role_claim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('user_role', new.role::text)
   where id = new.id;
  return new;
end $$;

drop trigger if exists profiles_role_claim on profiles;
create trigger profiles_role_claim
  after insert or update of role on profiles
  for each row execute function sync_role_claim();

-- ── 2. Одоо байгаа хэрэглэгчдийг нөхөх ─────────────────────────────────
update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('user_role', p.role::text)
  from profiles p
 where p.id = u.id
   and coalesce(u.raw_app_meta_data->>'user_role', '') is distinct from p.role::text;
