import { describe, expect, it } from "vitest";
import {
  describeRewardLadder,
  pickRewardTier,
  readRewardTiers,
} from "./reward-tiers";
import { couponSettingsError, type RewardTier } from "@/lib/validators/coupon";

const tier = (p: Partial<RewardTier> & { minTotal: number }): RewardTier => ({
  id: `t${p.minTotal}`,
  enabled: true,
  type: "percent",
  value: 10,
  validDays: 30,
  maxUsesPerUser: 1,
  ...p,
});

describe("pickRewardTier", () => {
  const t100 = tier({ minTotal: 100_000, value: 5 });
  const t300 = tier({ minTotal: 300_000, value: 15 });

  it("100k ба 300k хоёулаа асаалттай үед 300k+ захиалга зөвхөн 300k-ийнхийг авна", () => {
    expect(pickRewardTier([t100, t300], 350_000)?.id).toBe(t300.id);
    expect(pickRewardTier([t300, t100], 300_000)?.id).toBe(t300.id);
  });

  it("100k–300k хооронд 100k-ийнх", () => {
    expect(pickRewardTier([t100, t300], 299_999)?.id).toBe(t100.id);
    expect(pickRewardTier([t100, t300], 100_000)?.id).toBe(t100.id);
  });

  it("аль ч босгод хүрээгүй бол купонгүй", () => {
    expect(pickRewardTier([t100, t300], 99_999)).toBeNull();
    expect(pickRewardTier([], 1_000_000)).toBeNull();
  });

  it("унтраасан шатлал алгасагдаж, доод шатлал үйлчилнэ", () => {
    const off = { ...t300, enabled: false };
    expect(pickRewardTier([t100, off], 500_000)?.id).toBe(t100.id);
  });
});

describe("describeRewardLadder", () => {
  it("давхцахгүй мужууд, дээд нь хязгааргүй", () => {
    const rows = describeRewardLadder([
      tier({ minTotal: 300_000, value: 15 }),
      tier({ minTotal: 100_000, value: 5 }),
      tier({ minTotal: 200_000, enabled: false }),
    ]);
    expect(rows.map((r) => [r.from, r.to, r.value])).toEqual([
      [100_000, 299_999, 5],
      [300_000, null, 15],
    ]);
  });
});

describe("readRewardTiers", () => {
  it("хуучин autoGrant-ыг нэг шатлал болгоно", () => {
    const [t] = readRewardTiers({
      autoGrant: {
        enabled: true,
        minTotal: 300000,
        type: "fixed",
        value: 20000,
        validDays: 14,
      },
    });
    expect(t).toMatchObject({
      enabled: true,
      minTotal: 300_000,
      type: "fixed",
      value: 20_000,
      validDays: 14,
    });
  });

  it("tiers байвал autoGrant-ыг үл хэрэгсэнэ", () => {
    const tiers = readRewardTiers({
      autoGrant: { enabled: true, minTotal: 1 },
      tiers: [tier({ minTotal: 100_000 })],
    });
    expect(tiers).toHaveLength(1);
    expect(tiers[0].minTotal).toBe(100_000);
  });

  it("хоосон утга → шатлалгүй", () => {
    expect(readRewardTiers(null)).toEqual([]);
  });
});

describe("couponSettingsError", () => {
  it("зөв шатлалууд хадгалагдана", () => {
    expect(
      couponSettingsError({
        tiers: [tier({ minTotal: 100_000 }), tier({ minTotal: 300_000 })],
      }),
    ).toBeNull();
  });

  it("идэвхтэй хоёр шатлал ижил босготой бол татгалзана", () => {
    expect(
      couponSettingsError({
        tiers: [
          tier({ id: "a", minTotal: 100_000 }),
          tier({ id: "b", minTotal: 100_000 }),
        ],
      }),
    ).toMatch(/ижил доод дүн/);
  });

  it("нэг нь унтраалттай бол ижил босго зөвшөөрөгдөнө", () => {
    expect(
      couponSettingsError({
        tiers: [
          tier({ id: "a", minTotal: 100_000 }),
          tier({ id: "b", minTotal: 100_000, enabled: false }),
        ],
      }),
    ).toBeNull();
  });

  it("100%-аас дээш, 0 дүн, 0 хоногийг монголоор татгалзана", () => {
    expect(
      couponSettingsError({ tiers: [tier({ minTotal: 1, value: 101 })] }),
    ).toMatch(/1–100/);
    expect(couponSettingsError({ tiers: [tier({ minTotal: 0 })] })).toMatch(
      /Доод дүн/,
    );
    expect(
      couponSettingsError({ tiers: [tier({ minTotal: 1, validDays: 0 })] }),
    ).toMatch(/хоног/);
    expect(
      couponSettingsError({
        tiers: [tier({ minTotal: 1, type: "fixed", value: 0 })],
      }),
    ).toMatch(/Хямдралын/);
  });
});
