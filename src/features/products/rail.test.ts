import { describe, it, expect } from "vitest";
import { fillRail, interleave, mixCatalog, mixRandom, shuffle } from "./rail";
import type { ProductListItem } from "@/lib/types";
import type { Collection } from "@/features/collections/types";

const p = (id: string) => ({ id }) as ProductListItem;
const c = (id: string) => ({ id }) as Collection;
const ps = (n: number) => Array.from({ length: n }, (_, i) => p(`p${i + 1}`));
const cs = (n: number) => Array.from({ length: n }, (_, i) => c(`c${i + 1}`));

describe("fillRail", () => {
  it("6 багц + 6 ус", () => {
    const r = fillRail(ps(12), cs(8), 12, 6);
    expect(r.collections).toHaveLength(6);
    expect(r.products).toHaveLength(6);
  });

  it("3 багц л байвал 9 ус нөхнө", () => {
    const r = fillRail(ps(12), cs(3), 12, 6);
    expect(r.collections).toHaveLength(3);
    expect(r.products.map((x) => x.id)).toEqual(ps(9).map((x) => x.id));
  });

  it("багцгүй бол 12 ус", () => {
    expect(fillRail(ps(20), [], 12, 6).products).toHaveLength(12);
  });
});

describe("interleave", () => {
  it("эрэмбийг хадгалан ээлжлүүлж, үлдсэнийг араас нь залгана", () => {
    const ids = interleave(ps(3), cs(1)).map((x) =>
      x.kind === "product" ? x.product.id : x.collection.id,
    );
    expect(ids).toEqual(["p1", "c1", "p2", "p3"]);
  });
});

describe("shuffle / mixRandom", () => {
  it("элемент алдахгүй, оролтыг өөрчлөхгүй", () => {
    const xs = [1, 2, 3, 4, 5];
    const out = shuffle(xs);
    expect([...out].sort()).toEqual(xs);
    expect(xs).toEqual([1, 2, 3, 4, 5]);
  });

  it("ус, багц хоёуланг нь агуулна", () => {
    const items = mixRandom(ps(2), cs(2), () => 0);
    expect(items).toHaveLength(4);
    expect(items.filter((x) => x.kind === "collection")).toHaveLength(2);
  });
});

describe("mixCatalog", () => {
  const pp = (id: string, startingPrice: number) =>
    ({ id, name: id, startingPrice }) as ProductListItem;
  const cc = (id: string, startingPrice: number) =>
    ({ id, name: id, startingPrice }) as Collection;
  const key = (x: ReturnType<typeof mixCatalog>[number]) =>
    x.kind === "product" ? x.product.id : x.collection.id;

  it("үнээр эрэмбэлсэн бол багц байрандаа орно", () => {
    const out = mixCatalog(
      [pp("p1", 10), pp("p2", 30)],
      [cc("c1", 20), cc("c2", 40)],
      "price_asc",
      true,
    );
    expect(out.map(key)).toEqual(["p1", "c1", "p2", "c2"]);
  });

  it("дараагийн хуудас үлдсэн бол сүүлийн усны цаадах багц хүлээнэ", () => {
    const out = mixCatalog(
      [pp("p1", 10), pp("p2", 30)],
      [cc("c1", 20), cc("c2", 40)],
      "price_asc",
      false,
    );
    expect(out.map(key)).toEqual(["p1", "c1", "p2"]);
  });

  it("бусад эрэмбэд ээлжилнэ", () => {
    const out = mixCatalog(
      [pp("p1", 1), pp("p2", 1)],
      [cc("c1", 1)],
      "new",
      false,
    );
    expect(out.map(key)).toEqual(["p1", "c1", "p2"]);
  });
});
