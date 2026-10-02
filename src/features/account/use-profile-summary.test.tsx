import * as React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const maybeSingle = vi.fn();
let authListener: ((event: string) => void) | null = null;

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      getUser,
      onAuthStateChange: (cb: (event: string) => void) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

const { useProfileSummary } = await import("./use-profile-summary");

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
  authListener = null;
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "99112233@phone.vonscent.mn" } },
  });
  maybeSingle.mockResolvedValue({
    data: {
      full_name: "Болд",
      avatar_url: "https://img/a.png",
      role: "operator",
    },
  });
});

describe("useProfileSummary", () => {
  it("reads the profile once and serves a remount from cache", async () => {
    const client = new QueryClient();
    const first = renderHook(() => useProfileSummary(), {
      wrapper: wrapperFor(client),
    });
    expect(first.result.current.loading).toBe(true);
    await waitFor(() => expect(first.result.current.profile).not.toBeNull());
    expect(first.result.current.profile).toEqual({
      name: "Болд",
      handle: "99112233",
      avatar: "https://img/a.png",
      isStaff: true,
    });
    first.unmount();

    // The header remounting (admin → shop) must paint straight away.
    const second = renderHook(() => useProfileSummary(), {
      wrapper: wrapperFor(client),
    });
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.profile?.avatar).toBe("https://img/a.png");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("is a guest when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useProfileSummary(), {
      wrapper: wrapperFor(new QueryClient()),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
  });

  it("re-reads on sign-out but ignores a tab refocus SIGNED_IN", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useProfileSummary(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    act(() => authListener?.("SIGNED_IN"));
    expect(getUser).toHaveBeenCalledTimes(1);

    getUser.mockResolvedValue({ data: { user: null } });
    act(() => authListener?.("SIGNED_OUT"));
    await waitFor(() => expect(result.current.profile).toBeNull());
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
