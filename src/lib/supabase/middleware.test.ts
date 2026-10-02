import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `updateSession` against a stubbed Supabase client: `claims` is what the
 * token's signature says, `serverUser` what the Auth server says (they differ
 * for a revoked session), and `refreshed` simulates a token refresh writing
 * new cookies through `setAll` during `getClaims()`.
 */
const auth = {
  claims: null as { sub: string; app_metadata?: object } | null,
  serverUser: null as { id: string } | null,
  refreshed: false,
};
const createServerClient = vi.fn();

vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon" },
  isSupabaseConfigured: true,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

const { updateSession } = await import("./middleware");

beforeEach(() => {
  auth.claims = null;
  auth.serverUser = null;
  auth.refreshed = false;
  createServerClient.mockReset();
  createServerClient.mockImplementation(
    (
      _url: string,
      _key: string,
      opts: {
        cookies: {
          setAll: (c: { name: string; value: string; options?: object }[]) => void;
        };
      },
    ) => ({
      auth: {
        getClaims: async () => {
          if (auth.refreshed) {
            opts.cookies.setAll([
              { name: "sb-x-auth-token", value: "fresh", options: { path: "/" } },
            ]);
          }
          return { data: auth.claims ? { claims: auth.claims } : null };
        },
        getUser: async () => ({ data: { user: auth.serverUser } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
      }),
    }),
  );
});

const req = (path: string) => new NextRequest(new URL(path, "https://shop.test"));
const signedIn = (id = "u1") => {
  auth.claims = { sub: id };
  auth.serverUser = { id };
};
const location = (res: Response) => res.headers.get("location");

describe("updateSession — guarded pages", () => {
  it("sends a guest from /account to /login with next", async () => {
    const res = await updateSession(req("/account"));
    expect(location(res)).toBe("https://shop.test/login?next=%2Faccount");
  });

  it("lets a signed-in customer into /account", async () => {
    signedIn();
    const res = await updateSession(req("/account"));
    expect(location(res)).toBeNull();
  });
});

describe("updateSession — auth pages for a signed-in customer", () => {
  it("sends them on to next instead of showing /login", async () => {
    signedIn();
    const res = await updateSession(req("/login?next=%2Fcheckout"));
    expect(location(res)).toBe("https://shop.test/checkout");
  });

  it("covers /register too, defaulting to home", async () => {
    signedIn();
    const res = await updateSession(req("/register"));
    expect(location(res)).toBe("https://shop.test/");
  });

  it("never bounces back to an auth page (next=/login)", async () => {
    signedIn();
    const res = await updateSession(req("/login?next=%2Flogin"));
    expect(location(res)).toBe("https://shop.test/");
  });

  it("never leaves the site (open redirect)", async () => {
    signedIn();
    const res = await updateSession(
      req("/login?next=" + encodeURIComponent("//evil.com")),
    );
    expect(location(res)).toBe("https://shop.test/");
  });

  it("shows the form when the Auth server no longer knows the session", async () => {
    // Revoked session: the JWT still verifies, the server says no.
    auth.claims = { sub: "u1" };
    auth.serverUser = null;
    const res = await updateSession(req("/login"));
    expect(location(res)).toBeNull();
  });

  it("shows the form to a guest", async () => {
    const res = await updateSession(req("/login"));
    expect(location(res)).toBeNull();
  });

  it("leaves /forgot-password reachable", async () => {
    signedIn();
    const res = await updateSession(req("/forgot-password"));
    expect(location(res)).toBeNull();
  });
});

describe("updateSession — refreshed cookies", () => {
  it("carries a refreshed session over a redirect", async () => {
    signedIn();
    auth.refreshed = true;
    const res = await updateSession(req("/login?next=%2Faccount"));
    expect(location(res)).toBe("https://shop.test/account");
    expect(res.cookies.get("sb-x-auth-token")?.value).toBe("fresh");
  });

  it("carries it over the staff-only redirect", async () => {
    signedIn();
    auth.refreshed = true;
    const res = await updateSession(req("/admin"));
    expect(location(res)).toBe("https://shop.test/");
    expect(res.cookies.get("sb-x-auth-token")?.value).toBe("fresh");
  });
});

describe("updateSession — which paths read the session", () => {
  it("refreshes on /collections/build (its page reads the user)", async () => {
    await updateSession(req("/collections/build"));
    expect(createServerClient).toHaveBeenCalled();
  });

  it("skips the public, cached collection pages", async () => {
    await updateSession(req("/collections/summer-set"));
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
