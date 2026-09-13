import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const adminClient = vi.fn();

vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => rpc(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import {
  checkRateLimit,
  clientIp,
  enforceRateLimit,
  retryMessage,
  subjectKey,
  tooManyRequests,
} from "@/lib/rate-limit";

function post(headers: Record<string, string> = {}): Request {
  return new Request("https://vonscent.mn/api/contact", {
    method: "POST",
    headers,
  });
}

const ALLOWED = {
  allowed: true,
  retry_after: 0,
  remaining: 2,
  limit: 3,
  reset: 400,
};
const DENIED = {
  allowed: false,
  retry_after: 42,
  remaining: 0,
  limit: 3,
  reset: 600,
};

beforeEach(() => {
  rpc.mockReset();
  adminClient.mockReset().mockReturnValue({});
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry (the real client)", () => {
    expect(
      clientIp(post({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(post({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("is null without proxy headers (local dev)", () => {
    expect(clientIp(post())).toBeNull();
  });
});

describe("subjectKey", () => {
  it("never carries the raw address", () => {
    const key = subjectKey("ip", "203.0.113.7");
    expect(key).not.toContain("203.0.113.7");
    expect(key.startsWith("ip:")).toBe(true);
  });

  it("is stable per value and distinct across values and kinds", () => {
    expect(subjectKey("ip", "1.1.1.1")).toBe(subjectKey("ip", "1.1.1.1"));
    expect(subjectKey("ip", "1.1.1.1")).not.toBe(subjectKey("ip", "1.1.1.2"));
    expect(subjectKey("ip", "abc")).not.toBe(subjectKey("user", "abc"));
  });
});

describe("retryMessage", () => {
  it("counts in seconds under a minute, rounding up", () => {
    expect(retryMessage(12.2)).toContain("13 секундын");
  });

  it("switches to minutes at a minute and above", () => {
    expect(retryMessage(600)).toContain("10 минутын");
  });

  it("never tells the customer to wait zero", () => {
    expect(retryMessage(0)).toContain("1 секундын");
  });
});

describe("tooManyRequests", () => {
  it("answers 429 with Retry-After and the policy headers", async () => {
    const res = tooManyRequests("contact", {
      ok: false,
      retryAfter: 42,
      remaining: 0,
      limit: 3,
      reset: 600,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(res.headers.get("RateLimit")).toBe('"contact";r=0;t=42');
    expect(res.headers.get("RateLimit-Policy")).toBe('"contact";q=3;w=600');
    await expect(res.json()).resolves.toMatchObject({ error: "RATE_LIMITED" });
  });
});

describe("checkRateLimit", () => {
  it("charges the IP when no subject is given", async () => {
    rpc.mockResolvedValue({ data: ALLOWED, error: null });
    const verdict = await checkRateLimit(
      "contact",
      post({ "x-forwarded-for": "203.0.113.7" }),
    );

    expect(verdict.ok).toBe(true);
    const args = rpc.mock.calls[0][2] as Record<string, unknown>;
    expect(args).toMatchObject({
      p_bucket: "contact",
      p_limit: 3,
      p_period_seconds: 600,
      p_cost: 1,
    });
    expect(args.p_subject).toBe(subjectKey("ip", "203.0.113.7"));
  });

  it("charges the user when one is given, ignoring the IP", async () => {
    rpc.mockResolvedValue({ data: ALLOWED, error: null });
    await checkRateLimit("review", post({ "x-forwarded-for": "203.0.113.7" }), {
      subject: "user-1",
    });
    const args = rpc.mock.calls[0][2] as Record<string, unknown>;
    expect(args.p_subject).toBe(subjectKey("user", "user-1"));
  });

  it("labels a non-user subject by its kind", async () => {
    rpc.mockResolvedValue({ data: ALLOWED, error: null });
    await checkRateLimit("verifyStartPhone", post(), {
      subject: "99112233",
      subjectKind: "phone",
    });
    const args = rpc.mock.calls[0][2] as Record<string, unknown>;
    expect(args.p_subject).toBe(subjectKey("phone", "99112233"));
    // Утасны дугаар DB-д задарч харагдахгүй.
    expect(args.p_subject).not.toContain("99112233");
    // Ижил утга өөр төрлөөр ирвэл өөр хувин.
    expect(args.p_subject).not.toBe(subjectKey("user", "99112233"));
  });

  it("passes the verdict through when the limit is hit", async () => {
    rpc.mockResolvedValue({ data: DENIED, error: null });
    await expect(checkRateLimit("contact", post())).resolves.toMatchObject({
      ok: false,
      retryAfter: 42,
    });
  });

  // Fail-open: тоолуурын доголдол бодит захиалгыг зогсоох шалтгаан биш.
  it("lets the request through when Supabase isn't configured", async () => {
    adminClient.mockReturnValue(null);
    await expect(checkRateLimit("order", post())).resolves.toMatchObject({
      ok: true,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets the request through — and reports — when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(checkRateLimit("order", post())).resolves.toMatchObject({
      ok: true,
    });
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

describe("enforceRateLimit", () => {
  it("returns null while the caller is within the limit", async () => {
    rpc.mockResolvedValue({ data: ALLOWED, error: null });
    await expect(enforceRateLimit("quiz", post())).resolves.toBeNull();
  });

  it("returns a ready 429 once it is not", async () => {
    rpc.mockResolvedValue({ data: DENIED, error: null });
    const res = await enforceRateLimit("quiz", post());
    expect(res?.status).toBe(429);
  });
});
