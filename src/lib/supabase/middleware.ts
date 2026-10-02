import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";

/** Нэвтэрсэн хэрэглэгчид утгагүй хуудсууд — `next` руу (эсвэл нүүр) шилжинэ. */
const AUTH_PAGES = ["/login", "/register"];

/**
 * Refresh the Supabase session on each request and gate protected route groups.
 * No-ops when Supabase isn't configured so the demo storefront stays open.
 *
 * This runs on every request to a guarded path — including the RSC fetch behind
 * each client-side navigation — so anything it awaits lands in front of the
 * target route's `loading.tsx`. It used to await two Supabase round trips
 * (token verification, then a `profiles` read, 152-427ms measured), which is
 * why moving between admin screens felt stuck. Both are now answered from the
 * signed token itself; see below.
 *
 * The security boundary is unchanged and does not live here: RLS (`is_staff()`)
 * and `getStaffUser()` in every admin route handler both read `profiles` live.
 * This gate only decides whether the shell is shown.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname.startsWith("/admin");
  const isAccount = pathname.startsWith("/account");
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!isSupabaseConfigured) {
    // Without auth backend, let everything through (demo mode).
    return response;
  }

  // Public storefront pages read no session on the server (they render from
  // the cookie-less public client and are ISR-cached), so skip the Supabase
  // round-trip entirely — it would add latency to every cached page view.
  // The browser client refreshes its own token; the paths below are the ones
  // whose server side actually reads the session cookie.
  //
  // Every page that reads the session on the server MUST be listed here. A
  // Server Component cannot write cookies, so one outside this list that finds
  // an expired access token still spends the refresh token — and the rotated
  // one is dropped on the floor. The browser then refreshes with the old
  // token, Supabase sees it reused and revokes the whole session: the
  // customer is signed out for no visible reason. `/collections/build` reads
  // the user to prefill the builder, so it is here; the rest of /collections
  // is public and ISR-cached, so it is not.
  const needsSession =
    isAdmin ||
    isAccount ||
    isAuthPage ||
    [
      "/checkout",
      "/order",
      "/wishlist",
      "/cart",
      "/collections/build",
      "/api",
    ].some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
  if (!needsSession) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  /**
   * A redirect is a brand-new response, so the cookies `setAll` put on
   * `response` — a refreshed session, or stale ones being cleared — would be
   * lost with it. Dropping a refreshed session is the reuse trap described
   * above, so every redirect out of here carries them over.
   */
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  // Identity from the token itself.
  //
  // `getUser()` posts the JWT to the Auth server to have it verified; this
  // project signs with an asymmetric key (ES256, see the JWKS endpoint), so
  // `getClaims()` verifies the signature locally with WebCrypto instead and
  // caches the key set. Same guarantee — the signature is checked, a forged
  // cookie is rejected — without a network round trip on every request.
  //
  // `getUser()` stays as the fallback: if a project ever moves back to a
  // symmetric secret, or WebCrypto is missing, `getClaims()` says so and this
  // still behaves exactly as it did before.
  let userId: string | null = null;
  let role: string | null = null;
  // Whether the Auth server itself vouched for the session (`getUser()`), as
  // opposed to the token's signature alone (`getClaims()`).
  let verified = false;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (claims?.sub) {
      userId = claims.sub;
      const appRole = claims.app_metadata?.user_role;
      role = typeof appRole === "string" ? appRole : null;
    }
  } catch {
    // Fall through to getUser() below.
  }
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    verified = userId !== null;
  }

  if (!userId && (isAdmin || isAccount)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectTo(url);
  }

  if (userId && isAuthPage) {
    // A signed-in customer has no business on the login form. Without this,
    // Back after signing in (or a stale «Нэвтрэх» link) showed the form again
    // and people signed in a second time, believing they had been logged out.
    //
    // The signature alone is not enough here. A session revoked server-side
    // (signed out elsewhere, refresh-token reuse) keeps a validly signed JWT
    // until it expires, up to an hour: trusting it would bounce the customer
    // off /login while the browser — whose `getUser()` asks the Auth server —
    // shows them as a guest, locking them out of signing back in. So ask the
    // Auth server too; /login is rare enough that the round trip costs
    // nothing. If that check fails for any reason, show the form.
    if (!verified) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      verified = user?.id === userId;
    }
    if (verified) {
      const target = safeNext(request.nextUrl.searchParams.get("next"));
      const url = new URL(target, request.url);
      // `?next=/login` would bounce straight back here.
      if (AUTH_PAGES.includes(url.pathname))
        url.href = new URL("/", request.url).href;
      return redirectTo(url);
    }
  }

  if (userId && isAdmin) {
    // The role rides in the token (0054): `profiles.role` is mirrored into
    // `app_metadata`, so the common case costs nothing.
    //
    // A claim that *grants* access is taken at its word. A claim that denies —
    // or is absent, as on any token minted before 0054 — is re-checked against
    // the table before anyone is turned away, so an operator promoted five
    // minutes ago is never locked out for the hour their old token has left.
    // The asymmetry is deliberate: the cheap path is the one staff walk all
    // day, and the extra read only happens on a denial.
    const allowed = (r: string | null) =>
      r === "operator" || r === "super_admin";

    if (!allowed(role)) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      role = (data as { role?: string } | null)?.role ?? null;
    }
    if (!allowed(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return redirectTo(url);
    }
  }

  return response;
}
