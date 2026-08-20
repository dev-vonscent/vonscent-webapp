import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PASSCODE_RE, derivePassword, isPhoneEmail, phoneEmail } from "./phone";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));

describe("phone passcode auth helpers", () => {
  beforeEach(() => vi.stubEnv("AUTH_PASSCODE_PEPPER", "test-pepper"));
  afterEach(() => vi.unstubAllEnvs());

  it("accepts exactly 4 digits as a passcode", () => {
    expect(PASSCODE_RE.test("0421")).toBe(true);
    expect(PASSCODE_RE.test("123")).toBe(false);
    expect(PASSCODE_RE.test("12345")).toBe(false);
    expect(PASSCODE_RE.test("12a4")).toBe(false);
  });

  it("maps a phone to its synthetic email and back", () => {
    expect(phoneEmail("99112233")).toBe("99112233@phone.vonscent.mn");
    expect(isPhoneEmail("99112233@phone.vonscent.mn")).toBe(true);
    expect(isPhoneEmail("user@gmail.com")).toBe(false);
    expect(isPhoneEmail(null)).toBe(false);
  });

  it("derives a peppered password, never the raw passcode", () => {
    const pw = derivePassword("1234");
    expect(pw).toHaveLength(64);
    expect(pw).not.toContain("1234");
    expect(derivePassword("1234")).toBe(pw);
    expect(derivePassword("1235")).not.toBe(pw);
  });

  it("fails loudly when the pepper is missing", () => {
    vi.stubEnv("AUTH_PASSCODE_PEPPER", "");
    expect(() => derivePassword("1234")).toThrow(/AUTH_PASSCODE_PEPPER/u);
  });
});
