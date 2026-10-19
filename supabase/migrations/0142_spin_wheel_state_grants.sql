-- `spin_wheel_state(p_user)` — security definer, PUBLIC-д execute эрхтэй
-- байсан: anon түлхүүрээр ямар ч хэрэглэгчийн хүрдний төлөв (онооны үлдэгдэл,
-- захиалгын эрх, дараагийн үнэгүй эрхийн цаг)-ийг уншиж болно. Апп зөвхөн
-- service-role-оор дууддаг (`features/lucky-wheel/api.ts`).
--
-- `spin_wheel(uuid, text)`-ийн ижил алдааг 0140 засав. Хоёул feature-ээс үл
-- хамааран prod-д байгаа тул энэ хоёр migration-ыг тусад нь ч оруулж болно
-- (idempotent).
revoke all on function spin_wheel_state(uuid) from public, anon, authenticated;
do $$ begin
  grant execute on function spin_wheel_state(uuid) to service_role;
exception when undefined_object then null; end $$;
