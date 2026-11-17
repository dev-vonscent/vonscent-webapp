import { describe, it, expect } from "vitest";
import { dailyRandom, seededRandom } from "./seeded-random";
import {
  scatterCollections,
  shuffle,
  topUpRandom,
} from "@/features/products/rail";
import type { ProductListItem } from "@/lib/types";
import type { Collection } from "@/features/collections/types";

const take = (random: () => number, n: number) =>
  Array.from({ length: n }, () => random());

describe("seededRandom", () => {
  it("ижил seed → ижил дараалал", () => {
    expect(take(seededRandom("a"), 20)).toEqual(take(seededRandom("a"), 20));
  });

  it("өөр seed → өөр дараалал", () => {
    expect(take(seededRandom("a"), 5)).not.toEqual(take(seededRandom("b"), 5));
  });

  it("[0, 1) мужид", () => {
    for (const x of take(seededRandom("range"), 1000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("dailyRandom", () => {
  // 2026-11-16 УБ = UTC+8.
  const morning = new Date("2026-11-16T00:30:00Z"); // УБ 08:30
  const evening = new Date("2026-11-16T15:30:00Z"); // УБ 23:30
  const nextDay = new Date("2026-11-16T16:30:00Z"); // УБ 11-17 00:30

  it("УБ-ын нэг өдөр дотор ижил", () => {
    expect(take(dailyRandom("hot", morning), 10)).toEqual(
      take(dailyRandom("hot", evening), 10),
    );
  });

  it("УБ-ын шөнө дундаас солигдоно (UTC-ийн биш)", () => {
    expect(take(dailyRandom("hot", evening), 10)).not.toEqual(
      take(dailyRandom("hot", nextDay), 10),
    );
  });

  it("salt бүр өөрөөр холино", () => {
    expect(take(dailyRandom("hot", morning), 10)).not.toEqual(
      take(dailyRandom("new", morning), 10),
    );
  });
});

describe("rail + dailyRandom — ISR-д тогтвортой гаралт", () => {
  const p = (id: string) => ({ id }) as ProductListItem;
  const c = (id: string) => ({ id }) as Collection;
  const ps = Array.from({ length: 9 }, (_, i) => p(`p${i + 1}`));
  const cs = [c("c1"), c("c2"), c("c3")];
  const ids = (xs: ReturnType<typeof scatterCollections>) =>
    xs.map((x) => (x.kind === "product" ? x.product.id : x.collection.id));
  const now = new Date("2026-11-16T04:00:00Z");

  it("scatterCollections: ижил өгөгдөл, ижил өдөр → ижил rail", () => {
    const a = ids(scatterCollections(ps, cs, dailyRandom("home-hot", now)));
    const b = ids(scatterCollections(ps, cs, dailyRandom("home-hot", now)));
    expect(a).toEqual(b);
    // Дүрэм хэвээр: эхний нүд ус, нэг багц 2–4 дэх нүдэнд.
    expect(a[0]).toBe("p1");
    expect(a.slice(1, 4).some((id) => id.startsWith("c"))).toBe(true);
  });

  it("topUpRandom: ижил өдөр ижил багцаар нөхнө", () => {
    const pool = Array.from({ length: 10 }, (_, i) => c(`c${i + 1}`));
    const pick = () =>
      topUpRandom([c("c5")], pool, 3, dailyRandom("hot-collections", now)).map(
        (x) => x.id,
      );
    expect(pick()).toEqual(pick());
    expect(pick()[0]).toBe("c5");
  });

  it("shuffle: элемент алдахгүй", () => {
    const out = shuffle([1, 2, 3, 4, 5], dailyRandom("x", now));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
