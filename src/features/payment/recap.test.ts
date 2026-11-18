import { describe, expect, it } from "vitest";
import {
  VS2247_BASE_TOTAL,
  VS2247_ITEMS,
  VS2247_NIGHT_OUT,
} from "@/lib/orders/vs2247.fixture";
import { buildPaymentRecap } from "./recap";

const bundles = {
  baseIds: new Set([VS2247_NIGHT_OUT]),
  images: new Map([[VS2247_NIGHT_OUT, "https://img/night-out.jpg"]]),
};

describe("buildPaymentRecap — VS-2247", () => {
  const { lines, entries } = buildPaymentRecap(
    VS2247_ITEMS.map((i) => ({ ...i })),
    bundles,
    new Map([["p-oud-wood", "https://img/oud.jpg"]]),
  );

  it("дан (ml ↑) → багц (ml ↑) → бэлэг", () => {
    expect(
      entries.map((e) =>
        e.kind === "bundle"
          ? `${e.title} ${e.ml}ml`
          : `${e.line.name} ${e.line.ml}ml${e.line.isGift ? " бэлэг" : ""}`,
      ),
    ).toEqual([
      "Blanche 2ml",
      "Aventus 5ml",
      "Goddess EDP 10ml",
      "Oud Wood 20ml",
      "NIGHT OUT багц 2ml",
      "NIGHT OUT багц 10ml",
      "Glacial Essence 1ml бэлэг",
      "Homme intense 1ml бэлэг",
      "My Way 1ml бэлэг",
    ]);
  });

  it("багц нэг мөр — үндсэн үнэ, гишүүд, багцын зураг", () => {
    const small = entries.find((e) => e.kind === "bundle" && e.ml === 2);
    expect(small).toMatchObject({
      kind: "bundle",
      qty: 1,
      baseTotal: 69000,
      isGift: false,
      image: "https://img/night-out.jpg",
      members: [
        { brand: "Rabanne", name: "Invictus Victory elixir" },
        { brand: "Viktor&Rolf", name: "Spicebomb Extreme" },
        { brand: "Versace", name: "Eros Flame" },
        { brand: "Dior", name: "Homme intense" },
      ],
    });
    expect(
      entries.find((e) => e.kind === "bundle" && e.ml === 10),
    ).toMatchObject({ baseTotal: 260000 });
  });

  it("багцын зураггүй бол эхний гишүүний зураг", () => {
    const { entries: e } = buildPaymentRecap(
      VS2247_ITEMS.map((i) => ({ ...i })),
      { baseIds: bundles.baseIds, images: new Map() },
      new Map([["p-invictus-victory-elixir", "https://img/invictus.jpg"]]),
    );
    expect(e.find((x) => x.kind === "bundle" && x.ml === 2)).toMatchObject({
      image: "https://img/invictus.jpg",
    });
  });

  it("хямдралтай Goddess үндсэн үнээр, нийлбэр = «Нийт үндсэн үнэ»", () => {
    const goddess = entries.find(
      (e) => e.kind === "item" && e.line.name === "Goddess EDP",
    );
    expect(goddess).toMatchObject({
      line: { baseTotal: 78000, lineTotal: 62400 },
    });
    const sum = entries.reduce(
      (s, e) => s + (e.kind === "bundle" ? e.baseTotal : e.line.baseTotal),
      0,
    );
    expect(sum).toBe(VS2247_BASE_TOTAL);
  });

  it("analytics-ийн задгай мөрүүд бүгд, ижил дараалалтай", () => {
    expect(lines).toHaveLength(VS2247_ITEMS.length);
    expect(lines[0].name).toBe("Blanche");
    expect(lines.at(-1)?.name).toBe("My Way");
  });
});
