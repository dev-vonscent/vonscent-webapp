import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileInfo } from "../types";
import { ProfileInfoEntryCard } from "./profile-info-entry-card";

let data: ProfileInfo | undefined;
vi.mock("../use-profile-info", () => ({
  useProfileInfo: () => ({ data }),
}));

const full: ProfileInfo = {
  avatarUrl: "https://cdn.example/avatars/u-1.webp",
  fullName: "Болд",
  phone: "99112233",
  phoneVerified: true,
  email: "bold@example.mn",
  gender: "male",
  birthday: "1995-04-12",
  job: "Багш",
  scentPreferences: ["woody"],
  favoritePerfumes: ["Dior Sauvage"],
  address: { count: 1, summary: "Улаанбаатар" },
  reward: { points: 500, claimedPoints: 500 },
};

beforeEach(() => {
  data = undefined;
});

describe("ProfileInfoEntryCard", () => {
  it("ачаалж байхад энгийн мөр", () => {
    render(<ProfileInfoEntryCard />);
    expect(screen.getByRole("link").textContent).toBe("Миний мэдээлэл");
  });

  it("бүрэн бөглөж урамшууллаа авсан бол энгийн мөр", () => {
    data = full;
    render(<ProfileInfoEntryCard />);
    expect(screen.getByRole("link").textContent).toBe("Миний мэдээлэл");
  });

  it("дутуу бол үлдсэнийг ба урамшууллыг харуулна", () => {
    data = {
      ...full,
      job: "",
      gender: null,
      reward: { points: 500, claimedPoints: null },
    };
    render(<ProfileInfoEntryCard />);
    const text = screen.getByRole("link").textContent;
    expect(text).toContain("2 мэдээлэл үлдлээ");
    expect(text).toContain("+500");
  });

  it("урамшуулалгүй үед дутууг тоогоор", () => {
    data = { ...full, job: "", reward: { points: 0, claimedPoints: null } };
    render(<ProfileInfoEntryCard />);
    const text = screen.getByRole("link").textContent;
    expect(text).toContain("1 мэдээлэл дутуу");
    expect(text).toContain("9/10");
    expect(text).not.toContain("+");
  });

  it("бүрэн боловч урамшуулал аваагүй бол энгийн болохгүй", () => {
    data = { ...full, reward: { points: 500, claimedPoints: null } };
    render(<ProfileInfoEntryCard />);
    const text = screen.getByRole("link").textContent;
    expect(text).toContain("Урамшууллаа аваарай");
    expect(text).toContain("+500");
  });
});
