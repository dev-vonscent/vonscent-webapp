import {
  isAuthRetryableFetchError,
  type AuthError,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

/**
 * `auth.getUser()`-ийн алдаа түр зуурынх уу (сүлжээ, timeout, auth 5xx)?
 *
 * Энэ үед `user` null ирдэг ч хэрэглэгч гараагүй — «зочин» / 401 гэж үзвэл
 * poll зогсох, кэш устах зэргээр хэрэглэгч чимээгүй «гарсан» мэт болно.
 * Session байхгүй, JWT буруу (4xx) нь жинхэнэ гаралт тул false.
 */
export function isTransientAuthError(error: AuthError | null): boolean {
  if (!error) return false;
  return isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500;
}

/**
 * `auth.getUser()`, түр зуурын алдаа гарвал хэдэн удаа дахин оролдоно.
 *
 * Гар утасны сүлжээ хором тасрахад ганц оролдлого `user: null` буцааж,
 * нэвтэрсэн хэрэглэгчийг «зочин» болгодог байв (checkout-д купон, V point
 * алга болно). Буцаах утга:
 *   - `user` — нэвтэрсэн;
 *   - `null` — жинхэнэ зочин (session байхгүй / хүчингүй);
 *   - `undefined` — бүх оролдлого түр алдаагаар дууссан, мэдэгдэхгүй.
 */
export async function getUserRetrying(
  supabase: Pick<SupabaseClient, "auth">,
  { attempts = 3, delayMs = 800 }: { attempts?: number; delayMs?: number } = {},
): Promise<User | null | undefined> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return data.user;
    if (!isTransientAuthError(error)) return null;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  return undefined;
}
