import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GiftPool } from "@/features/gifts/use-gift-pool";

const POOL: GiftPool = {
  enabled: true,
  threshold: 200000,
  sampleMl: 1,
  vialOut: false,
  products: [{ id: "g1", name: "Santal 33", brand: "Le Labo", image: null }],
};

let pool: GiftPool | null = POOL;
vi.mock("@/features/gifts/use-gift-pool", () => ({
  useGiftPool: () => pool,
}));

import { GiftProgressNote } from "./gift-progress-note";

describe("GiftProgressNote", () => {
  it("энгийн үед бэлгээ сонгохыг сануулна", () => {
    pool = POOL;
    render(<GiftProgressNote subtotal={250000} />);
    expect(screen.getByText(/бэлгээ сонгоорой/)).toBeInTheDocument();
  });

  it("1ml сав дууссан/хаалттай бол «түр дууссан» — сонгоно гэж амлахгүй", () => {
    // useGiftPool: хоосон санд enabled=false.
    pool = { ...POOL, enabled: false, vialOut: true, products: [] };
    render(<GiftProgressNote subtotal={250000} />);
    expect(screen.getByText("Бэлгийн дээж түр дууссан")).toBeInTheDocument();
    expect(screen.queryByText(/бэлгээ сонгоорой/)).not.toBeInTheDocument();
  });
});
