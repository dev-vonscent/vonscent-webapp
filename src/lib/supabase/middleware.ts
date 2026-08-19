import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Refresh the Supabase session on each request and gate protected route groups.
 * No-ops when Supabase isn't configured so the demo storefront stays open.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname.startsWith("/admin");
  const isAccount = pathname.startsWith("/account");

  if (!isSupabaseConfigured) {
    // Without auth backend, let everything through (demo mode).
    return response;
  }

  // Public storefront pages read no session on the server (they render from
  // the cookie-less public client and are ISR-cached), so skip the Supabase
  // round-trip entirely — it would add latency to every cached page view.
  // The browser client refreshes its own token; the paths below are the ones
  // whose server side actually reads the session cookie.
  const needsSession =
    isAdmin ||
    isAccount ||
    ["/checkout", "/order", "/wishlist", "/cart", "/login", "/api"].some(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (isAdmin || isAccount)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAdmin) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (data as { role?: string } | null)?.role;
    if (role !== "operator" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
