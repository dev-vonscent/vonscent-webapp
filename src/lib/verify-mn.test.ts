import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyPhone } from "./verify-mn";

// Keep the DB out of these tests — the lib skips storage without a client.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const json = (status: number, body: unknown = {}): MockResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const PHONE = "99112233";
const SESSION = "sess_123";

/** POST /sessions response, expiring `ttlMs` from the (faked) current time. */
function sessionBody(ttlMs: number) {
  return {
    sessionId: SESSION,
    phone: PHONE,
    shortcode: "144773",
    text: "482916",
    smsUri: "sms:144773?body=482916",
    displayInstruction: "144773 дугаарт кодоо илгээнэ үү",
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}

function statusBody(sessionStatus: "PENDING" | "VERIFIED" | "EXPIRED") {
  return {
    sessionId: SESSION,
    phone: PHONE,
    sessionStatus,
    callbackStatus: "PENDING",
    verifiedAt: sessionStatus === "VERIFIED" ? new Date().toISOString() : null,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
}

describe("verifyPhone (verify.mn)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERIFY_MN_API_KEY", "test-key");
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves true when the session goes PENDING -> VERIFIED", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, sessionBody(300_000))) // POST /sessions
      .mockResolvedValueOnce(json(200, statusBody("PENDING")))
      .mockResolvedValueOnce(json(200, statusBody("VERIFIED")));

    const result = verifyPhone(PHONE);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(result).resolves.toBe(true);

    // Session create carries the key and a fresh 6-digit code.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.verify.mn/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    const body = JSON.parse(init.body as string) as { text: string };
    expect(body.text).toMatch(/^\d{6}$/u);
  });

  it("resolves false when expiresAt passes while still PENDING", async () => {
    fetchMock.mockResolvedValueOnce(json(200, sessionBody(10_000)));
    fetchMock.mockResolvedValue(json(200, statusBody("PENDING")));

    const result = verifyPhone(PHONE);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(result).resolves.toBe(false);
  });

  it("resolves false as soon as the session reports EXPIRED", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, sessionBody(300_000)))
      .mockResolvedValueOnce(json(200, statusBody("EXPIRED")));

    const result = verifyPhone(PHONE);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toBe(false);
  });

  it("polls no faster than every 3 seconds", async () => {
    fetchMock.mockResolvedValueOnce(json(200, sessionBody(300_000)));
    fetchMock.mockResolvedValue(json(200, statusBody("PENDING")));

    void verifyPhone(PHONE).catch(() => {});
    await vi.advanceTimersByTimeAsync(9_500);
    // 1 create + at most 3 status polls in 9.5s.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
    await vi.advanceTimersByTimeAsync(300_000);
  });

  it("rejects with a clear error on 401 (bad API key)", async () => {
    fetchMock.mockResolvedValueOnce(json(401));

    await expect(verifyPhone(PHONE)).rejects.toThrow(
      /rejected VERIFY_MN_API_KEY/u,
    );
  });

  it("fails loudly when VERIFY_MN_API_KEY is missing", async () => {
    vi.stubEnv("VERIFY_MN_API_KEY", "");

    await expect(verifyPhone(PHONE)).rejects.toThrow(
      /VERIFY_MN_API_KEY is not set/u,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
