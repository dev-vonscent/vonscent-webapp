import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Leaderboard, LeaderboardEntry } from "../types";
import { TopCustomers } from "./top-customers";

function entry(over: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    rank: 1,
    amount: 100_000,
    name: "Болормаа",
    avatarUrl: null,
    tier: "gold",
    isMe: false,
    ...over,
  };
}

const board = (top: LeaderboardEntry[], me: LeaderboardEntry | null = null) =>
  ({ top, me }) satisfies Leaderboard;

describe("TopCustomers", () => {
  it("хугацааны табаар жагсаалт, дүн солигдоно", async () => {
    render(
      <TopCustomers
        boards={{
          week: board([entry({ name: "Долоо", amount: 120_000 })]),
          month: board([entry({ name: "Сар", amount: 980_000 })]),
          all: board([entry({ name: "Бүх", amount: 12_500_000 })]),
        }}
      />,
    );
    expect(screen.getByText("Долоо")).toBeInTheDocument();
    expect(screen.getByText("120,000₮")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Сүүлийн 1 сар" }));
    expect(screen.getByText("Сар")).toBeInTheDocument();
    expect(screen.getByText("980,000₮")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Бүх цаг үе" }));
    expect(screen.getByText("Бүх")).toBeInTheDocument();
    expect(screen.getByText("12,500,000₮")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Бүх цаг үе" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("сул байранд урилга — үзэгч өөрөө топод байвал гарахгүй", () => {
    const { rerender } = render(
      <TopCustomers
        boards={{
          week: board([entry({})]),
          month: board([]),
          all: board([]),
        }}
      />,
    );
    expect(screen.getAllByText("Энэ байр таных байж болно")).toHaveLength(2);

    rerender(
      <TopCustomers
        boards={{
          week: board([entry({ isMe: true })]),
          month: board([]),
          all: board([]),
        }}
      />,
    );
    expect(screen.queryByText("Энэ байр таных байж болно")).toBeNull();
    expect(screen.getAllByText("Сул")).toHaveLength(2);
    expect(screen.getByText("(Та)")).toBeInTheDocument();
  });

  it("өөрийн байрны мөр зөвхөн `showMe`-тэй үед", () => {
    const boards = {
      week: board([entry({})], entry({ rank: 7, isMe: true })),
      month: board([]),
      all: board([]),
    };
    const { rerender } = render(<TopCustomers boards={boards} />);
    expect(screen.queryByText("#7")).toBeNull();

    rerender(<TopCustomers boards={boards} showMe />);
    expect(screen.getByText("#7")).toBeInTheDocument();
  });

  it("хүн бүр өөрийн түвшний хүрээтэй", () => {
    const { container } = render(
      <TopCustomers
        boards={{
          week: board([
            entry({ rank: 1, tier: "ruby" }),
            entry({ rank: 2, tier: "sapphire", name: "Сараа" }),
          ]),
          month: board([]),
          all: board([]),
        }}
      />,
    );
    const tiers = [...container.querySelectorAll("[data-tier]")].map((el) =>
      el.getAttribute("data-tier"),
    );
    expect(tiers.sort()).toEqual(["ruby", "sapphire"]);
  });
});
