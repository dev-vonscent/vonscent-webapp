import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const eq = vi.fn();
let client: unknown = null;

vi.mock("@sentry/nextjs", () => ({ captureException }));
// Кэш нь Next-ийн runtime — тестэд шууд дуудна.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
vi.mock("@/lib/constants", async (orig) => ({
  ...(await orig<typeof import("@/lib/constants")>()),
  FEATURE_FLAGS: {
    tier_list: { label: "Tier list", description: "" },
    reviews_v2: { label: "Сэтгэгдэл v2", description: "" },
  },
}));

const { getEnabledFeatureFlags, isFeatureEnabled } =
  await import("./feature-flags");
const { featureFlagUpdateSchema } = await import("./validators/feature-flag");

beforeEach(() => {
  captureException.mockReset();
  eq.mockReset();
  client = { from: () => ({ select: () => ({ eq }) }) };
});

describe("getEnabledFeatureFlags", () => {
  it("зөвхөн асаалттай, кодонд бүртгэлтэй тугууд", async () => {
    eq.mockResolvedValue({
      data: [{ key: "tier_list" }, { key: "removed_flag" }],
      error: null,
    });
    expect(await getEnabledFeatureFlags()).toEqual(["tier_list"]);
    expect(eq).toHaveBeenCalledWith("enabled", true);
    // FEATURE_FLAGS mock — төрлийн түвшинд хоосон хэвээр тул `as never`.
    expect(await isFeatureEnabled("tier_list" as never)).toBe(true);
    expect(await isFeatureEnabled("reviews_v2" as never)).toBe(false);
  });

  it("сангийн алдаа → бүгд унтраалттай (fail closed) + Sentry", async () => {
    eq.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getEnabledFeatureFlags()).toEqual([]);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("Supabase тохируулаагүй (demo) → бүгд унтраалттай", async () => {
    client = null;
    expect(await getEnabledFeatureFlags()).toEqual([]);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe("featureFlagUpdateSchema", () => {
  it("бүртгэлтэй туг л хүлээж авна", () => {
    expect(
      featureFlagUpdateSchema.safeParse({ key: "tier_list", enabled: true })
        .success,
    ).toBe(true);
    expect(
      featureFlagUpdateSchema.safeParse({ key: "nope", enabled: true }).success,
    ).toBe(false);
    // Prototype-ийн түлхүүр туг биш.
    expect(
      featureFlagUpdateSchema.safeParse({ key: "toString", enabled: true })
        .success,
    ).toBe(false);
    expect(
      featureFlagUpdateSchema.safeParse({ key: "tier_list", enabled: "yes" })
        .success,
    ).toBe(false);
  });
});
