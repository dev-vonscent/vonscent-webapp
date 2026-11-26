import { describe, expect, it, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type User,
} from "@supabase/supabase-js";
import { getUserRetrying } from "./auth-errors";

const USER = { id: "u1" } as User;

function clientReturning(...results: Array<{ user: User | null; error: unknown }>) {
  const getUser = vi.fn();
  for (const r of results) {
    getUser.mockResolvedValueOnce({ data: { user: r.user }, error: r.error });
  }
  return { client: { auth: { getUser } } as never, getUser };
}

describe("getUserRetrying", () => {
  it("returns the user on the first success", async () => {
    const { client, getUser } = clientReturning({ user: USER, error: null });
    await expect(getUserRetrying(client, { delayMs: 0 })).resolves.toBe(USER);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("returns null without retrying when there is no session", async () => {
    const { client, getUser } = clientReturning({
      user: null,
      error: new AuthSessionMissingError(),
    });
    await expect(getUserRetrying(client, { delayMs: 0 })).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("returns null without retrying on a 4xx (invalid session)", async () => {
    const { client, getUser } = clientReturning({
      user: null,
      error: new AuthApiError("session_not_found", 403, "session_not_found"),
    });
    await expect(getUserRetrying(client, { delayMs: 0 })).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("retries a transient network error and recovers the user", async () => {
    const { client, getUser } = clientReturning(
      { user: null, error: new AuthRetryableFetchError("Failed to fetch", 0) },
      { user: USER, error: null },
    );
    await expect(getUserRetrying(client, { delayMs: 0 })).resolves.toBe(USER);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("returns undefined when every attempt fails transiently", async () => {
    const err = { user: null, error: new AuthRetryableFetchError("502", 502) };
    const { client, getUser } = clientReturning(err, err, err);
    await expect(
      getUserRetrying(client, { attempts: 3, delayMs: 0 }),
    ).resolves.toBeUndefined();
    expect(getUser).toHaveBeenCalledTimes(3);
  });
});
