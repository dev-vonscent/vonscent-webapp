import { describe, expect, it } from "vitest";
import {
  isValidBirthday,
  profileInfoPatchSchema,
} from "@/lib/validators/profile-info";
import {
  ageOn,
  formatBirthday,
  isFieldFilled,
  nextMissingField,
  profileCompletion,
} from "./lib";
import type { ProfileInfo } from "./types";

const empty: ProfileInfo = {
  avatarUrl: null,
  fullName: "",
  phone: "",
  phoneVerified: false,
  email: null,
  gender: null,
  birthday: null,
  job: "",
  scentPreferences: [],
  favoritePerfumes: [],
  address: { count: 0, summary: null },
  reward: { points: 500, claimedPoints: null },
};

const full: ProfileInfo = {
  ...empty,
  avatarUrl: "https://cdn.example/avatars/u-1.webp",
  fullName: "Болд",
  phone: "99112233",
  phoneVerified: true,
  email: "bold@example.mn",
  gender: "male",
  birthday: "1995-04-12",
  job: "Инженер",
  scentPreferences: ["woody"],
  favoritePerfumes: ["Dior Sauvage"],
  address: { count: 1, summary: "Улаанбаатар, СБД" },
};

describe("profileCompletion", () => {
  it("counts nothing for an empty profile", () => {
    expect(profileCompletion(empty)).toMatchObject({
      done: 0,
      total: 10,
      complete: false,
    });
  });

  it("is complete when every field is filled", () => {
    expect(profileCompletion(full)).toMatchObject({
      done: 10,
      ratio: 1,
      complete: true,
    });
  });

  it("treats an unverified phone and whitespace name as empty", () => {
    const info = { ...full, phoneVerified: false, fullName: "  " };
    expect(isFieldFilled(info, "phone")).toBe(false);
    expect(isFieldFilled(info, "fullName")).toBe(false);
    expect(profileCompletion(info).done).toBe(8);
  });
});

describe("isValidBirthday", () => {
  const today = new Date("2026-10-19T12:00:00Z");
  it("accepts a real past date", () => {
    expect(isValidBirthday("1995-04-12", today)).toBe(true);
  });
  it("rejects impossible, future and ancient dates", () => {
    expect(isValidBirthday("1995-02-31", today)).toBe(false);
    expect(isValidBirthday("2027-01-01", today)).toBe(false);
    expect(isValidBirthday("1899-12-31", today)).toBe(false);
    expect(isValidBirthday("12/04/1995", today)).toBe(false);
  });
});

describe("profileInfoPatchSchema", () => {
  it("accepts a single field", () => {
    expect(profileInfoPatchSchema.safeParse({ job: "Багш" }).success).toBe(
      true,
    );
  });
  it("rejects empty bodies, unknown keys and more than 3 perfumes", () => {
    expect(profileInfoPatchSchema.safeParse({}).success).toBe(false);
    expect(profileInfoPatchSchema.safeParse({ loyaltyPoints: 1 }).success).toBe(
      false,
    );
    expect(
      profileInfoPatchSchema.safeParse({
        favoritePerfumes: ["a", "b", "c", "d"],
      }).success,
    ).toBe(false);
  });
  it("rejects a blank job, unknown gender and impossible birthday", () => {
    expect(profileInfoPatchSchema.safeParse({ job: "   " }).success).toBe(
      false,
    );
    expect(profileInfoPatchSchema.safeParse({ gender: "x" }).success).toBe(
      false,
    );
    expect(
      profileInfoPatchSchema.safeParse({ birthday: "1995-02-31" }).success,
    ).toBe(false);
  });
});

describe("formatBirthday", () => {
  it("reads in Mongolian without leading zeros", () => {
    expect(formatBirthday("1995-03-04")).toBe("1995 оны 3-р сарын 4");
  });
});

describe("nextMissingField", () => {
  it("returns the first unfilled field in display order", () => {
    expect(nextMissingField(empty)).toBe("avatar");
    expect(nextMissingField({ ...full, job: " " })).toBe("job");
  });

  it("returns null once everything is filled", () => {
    expect(nextMissingField(full)).toBeNull();
  });
});

describe("ageOn", () => {
  it("counts a birthday reached this year", () => {
    expect(ageOn("1995-03-14", "2026-03-14")).toBe(31);
  });

  it("is one less before this year's birthday", () => {
    expect(ageOn("1995-03-14", "2026-03-13")).toBe(30);
  });
});
