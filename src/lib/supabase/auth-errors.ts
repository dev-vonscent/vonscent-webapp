import {
  isAuthRetryableFetchError,
  type AuthError,
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
