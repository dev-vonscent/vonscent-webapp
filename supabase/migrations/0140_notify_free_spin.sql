-- «Азын хүрдний өдрийн үнэгүй эрх сэргэлээ» мэдэгдэл
-- (docs/planning/notifications-plan.md §4.2).
--
-- Төлөвлөгөөнөөс зөрсөн: `spin_wheel` (0129, ~220 мөр)-ийг хуулж засахын
-- оронд `spin_wheel_spins` дээр AFTER INSERT trigger. Үр дүн нь ижил —
-- үнэгүй эргэлт бүр нэг мөр бичдэг (`spin_type = 'free'`) — харин том
-- функцын шинэ хувилбарыг санамсаргүй хуучруулах эрсдэл огт байхгүй.
--
-- Эргэлт бүрд:
--   1. тухайн хэрэглэгчийн УНШААГҮЙ `free_spin_ready` мөрүүдийг устгана
--      (өмнөх «эрх сэргэлээ» одоо худал болсон);
--   2. шинэ мөр: `visible_at = эргэлт + freeSpinHours` — тэр цагт л
--      харагдана (poll-ын cursor нь `visible_at`-аар тул «шинэ» болж ирнэ).
--
-- `lucky_wheel` туг / хүрд «Идэвхгүй» үед устгах биш УНШИХ үед шүүнэ
-- (`features/notifications/server.ts` → `hideFreeSpin`).

create or replace function spin_wheel_spins_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hours int;
begin
  if new.spin_type is distinct from 'free' then
    return new;
  end if;

  delete from user_notifications
   where user_id = new.user_id
     and kind = 'free_spin_ready'
     and read_at is null;

  select coalesce((value->>'freeSpinHours')::int, 24) into v_hours
    from settings where key = 'spin';
  v_hours := coalesce(v_hours, 24);

  perform notify_user(
    new.user_id,
    'free_spin_ready',
    'Азын хүрдний өдрийн үнэгүй эрх сэргэлээ',
    'Азаа дахин нэг туршаад үзээрэй.',
    '/lucky-wheel',
    jsonb_build_object('spinId', new.id, 'spunAt', new.created_at),
    'free_spin:' || new.id,
    new.created_at + make_interval(hours => v_hours)
  );
  return new;
end $$;

drop trigger if exists spin_wheel_spins_notify on spin_wheel_spins;
create trigger spin_wheel_spins_notify
  after insert on spin_wheel_spins
  for each row execute function spin_wheel_spins_notify();

-- `freeSpinHours` өөрчлөгдвөл уншаагүй `free_spin_ready` мөрүүдийн
-- `visible_at`-ийг шинэ цагаар дахин тооцно — `spin_wheel_state()`-тэй
-- үргэлж таарна. Төлөвлөгөөнд «ирээдүйн» мөр гэж байсан; бүх уншаагүйг
-- шинэчилнэ: цагийг уртасгахад аль хэдийн харагдсан «эрх сэргэлээ» худал
-- болох тул тэр нь ч ирээдүй рүү шилжих ёстой.
create or replace function settings_spin_notify_hours()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hours int;
begin
  if new.key <> 'spin' then
    return new;
  end if;
  v_hours := coalesce((new.value->>'freeSpinHours')::int, 24);
  if v_hours is not distinct from coalesce((old.value->>'freeSpinHours')::int, 24) then
    return new;
  end if;

  update user_notifications
     set visible_at = (data->>'spunAt')::timestamptz + make_interval(hours => v_hours)
   where kind = 'free_spin_ready'
     and read_at is null
     and data ? 'spunAt';
  return new;
end $$;

drop trigger if exists settings_spin_notify_hours on settings;
create trigger settings_spin_notify_hours
  after update on settings
  for each row execute function settings_spin_notify_hours();

-- Хуучин алдааг засав: 0129 `spin_wheel`-ийг `(uuid, text)` гарын үсэгтэй
-- шинээр үүсгэхэд 0053b-ийн `revoke … from public` нь хуучин
-- `(uuid, boolean)`-д үлдсэн тул шинэ функц PUBLIC-д нээлттэй байв —
-- `security definer` + `p_user` параметртэй тул anon/authenticated түлхүүрээр
-- бусдын нэрийн өмнөөс эргүүлэх боломжтой. Апп зөвхөн service-role-оор
-- дууддаг (`features/lucky-wheel/api.ts`).
revoke all on function spin_wheel(uuid, text) from public, anon, authenticated;
revoke all on function spin_wheel_spins_notify() from public, anon, authenticated;
revoke all on function settings_spin_notify_hours() from public, anon, authenticated;
do $$ begin
  grant execute on function spin_wheel(uuid, text) to service_role;
exception when undefined_object then null; end $$;
