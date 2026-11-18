import { describe, expect, it } from "vitest";
import {
  buildOrderLines,
  bundleTitle,
  flattenOrderLines,
  lineBase,
  orderLineAmount,
  type OrderLine,
  type OrderLineInput,
} from "./order-lines";

let seq = 0;
const line = (over: Partial<OrderLineInput>): OrderLineInput => ({
  id: `id-${String(++seq).padStart(3, "0")}`,
  product_name: "Aventus",
  brand: "Creed",
  ml: 5,
  qty: 1,
  unit_price: 30000,
  list_price: 35000,
  is_gift: false,
  is_sample: false,
  collection_id: null,
  collection_name: null,
  line_kind: "perfume",
  line_no: null,
  spin_id: null,
  product_id: null,
  ...over,
});

/** Мөрийн товч шошго — дарааллыг уншихад. */
const label = (l: OrderLine<OrderLineInput>) =>
  l.kind === "bundle"
    ? `[${l.gift ? "gift " : ""}${l.type} ${l.name} ${l.ml}ml ×${l.qty}: ${l.members.map((m) => m.product_name).join(", ")}]`
    : `${l.item.product_name} ${l.item.ml ?? "-"}${l.item.is_gift || l.item.is_sample ? " (gift)" : ""}`;

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Мөрүүдийн нийлбэр = «Барааны дүн» (gross_subtotal = Σ list_price × qty). */
function expectGrossPreserved(items: OrderLineInput[], baseIds: Set<string>) {
  const lines = buildOrderLines(items, baseIds);
  expect(sum(lines.map(orderLineAmount))).toBe(sum(items.map(lineBase)));
  // Мөр бүр яг нэг удаа гарна.
  expect(
    flattenOrderLines(lines)
      .map((i) => i.id)
      .sort(),
  ).toEqual(items.map((i) => i.id).sort());
}

describe("buildOrderLines", () => {
  // VS-2022 (dev): дан 2ml, 3 бэлэн багц (2ml), 1ml бэлэг — REST-ээс
  // физик дарааллаар (line_no 1, 14, 15, 3, 6, 5, …) ирдэг.
  const base = new Set(["gentleman", "clean-girl", "creed"]);
  const g = (n: number, name: string, list: number, unit: number) =>
    line({
      line_no: n,
      product_name: name,
      ml: 2,
      collection_id: "gentleman",
      collection_name: "GENTLEMAN",
      list_price: list,
      unit_price: unit,
    });
  const cg = (n: number, name: string) =>
    line({
      line_no: n,
      product_name: name,
      ml: 2,
      collection_id: "clean-girl",
      collection_name: "CLEAN GIRL",
      list_price: 17000,
      unit_price: 16150,
    });
  const cr = (n: number, name: string) =>
    line({
      line_no: n,
      product_name: name,
      ml: 2,
      collection_id: "creed",
      collection_name: "CREED",
      list_price: 35000,
      unit_price: 33261,
    });
  const vs2022 = [
    line({ line_no: 1, product_name: "Solo Aventus", ml: 2, qty: 3 }),
    line({
      line_no: 14,
      product_name: "Glacial",
      ml: 1,
      is_gift: true,
      is_sample: true,
      list_price: 0,
      unit_price: 0,
    }),
    line({
      line_no: 15,
      product_name: "My Way",
      ml: 1,
      is_gift: true,
      is_sample: true,
      list_price: 0,
      unit_price: 0,
    }),
    g(3, "Bleu", 21000, 19960),
    cg(6, "Lazy Sunday"),
    g(5, "Aventus", 35000, 33266),
    cr(13, "SMW"),
    g(2, "Layton", 29000, 27564),
    cr(12, "GIT"),
    cr(11, "Aventus"),
    cg(9, "Blooming"),
    cg(7, "Splendide"),
    g(4, "Ombre", 22000, 20910),
    cg(8, "Blanche"),
    cr(10, "Absolu"),
  ];

  it("VS-2022: дан → багцууд (line_no-оор) → бэлэг", () => {
    expect(buildOrderLines(vs2022, base).map(label)).toEqual([
      "Solo Aventus 2",
      "[base GENTLEMAN 2ml ×1: Layton, Bleu, Ombre, Aventus]",
      "[base CLEAN GIRL 2ml ×1: Lazy Sunday, Splendide, Blanche, Blooming]",
      "[base CREED 2ml ×1: Absolu, Aventus, GIT, SMW]",
      "Glacial 1 (gift)",
      "My Way 1 (gift)",
    ]);
    expectGrossPreserved(vs2022, base);
  });

  it("багцын base = гишүүдийн list_price × qty нийлбэр", () => {
    const gentleman = buildOrderLines(vs2022, base).find(
      (l) => l.kind === "bundle" && l.name === "GENTLEMAN",
    );
    expect(gentleman).toMatchObject({ base: 29000 + 21000 + 22000 + 35000 });
  });

  it("VS-1253: дан бараа ml өсөхөөр, ижил ml дотор line_no хэвээр", () => {
    const items = [
      line({ line_no: 1, product_name: "A", ml: 5 }),
      line({ line_no: 2, product_name: "B", ml: 2 }),
      line({ line_no: 3, product_name: "C", ml: 20 }),
      line({ line_no: 4, product_name: "D", ml: 5 }),
      line({ line_no: 5, product_name: "E", ml: 10 }),
      line({ line_no: 6, product_name: "F", ml: 2 }),
    ].reverse();
    expect(buildOrderLines(items, new Set()).map(label)).toEqual([
      "B 2",
      "F 2",
      "A 5",
      "D 5",
      "E 10",
      "C 20",
    ]);
  });

  it("багцууд ml өсөхөөр, дан барааны дараа, нэмэлт бараа дунд нь", () => {
    const items = [
      line({
        line_no: 1,
        product_name: "M20",
        ml: 20,
        collection_id: "creed",
        collection_name: "CREED",
      }),
      line({
        line_no: 2,
        product_name: "M5",
        ml: 5,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
      }),
      line({
        line_no: 3,
        product_name: "Хайрцаг",
        ml: null,
        line_kind: "extra",
        brand: "Сав",
      }),
      line({ line_no: 4, product_name: "Solo10", ml: 10 }),
    ];
    expect(buildOrderLines(items, base).map(label)).toEqual([
      "Solo10 10",
      "Хайрцаг -",
      "[base GENTLEMAN 5ml ×1: M5]",
      "[base CREED 20ml ×1: M20]",
    ]);
    expectGrossPreserved(items, base);
  });

  it("qty > 1 нэг мөр, нэг багц 2 хэмжээгээр бол 2 мөр", () => {
    const items = [
      line({
        line_no: 1,
        product_name: "A",
        ml: 10,
        qty: 2,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
      }),
      line({
        line_no: 2,
        product_name: "B",
        ml: 10,
        qty: 2,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
        list_price: 25000,
      }),
      line({
        line_no: 3,
        product_name: "A",
        ml: 5,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
      }),
      line({
        line_no: 4,
        product_name: "B",
        ml: 5,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
      }),
    ];
    const lines = buildOrderLines(items, base);
    expect(lines.map(label)).toEqual([
      "[base GENTLEMAN 5ml ×1: A, B]",
      "[base GENTLEMAN 10ml ×2: A, B]",
    ]);
    expect(lines[1]).toMatchObject({ base: 35000 * 2 + 25000 * 2 });
    expectGrossPreserved(items, base);
  });

  // VS-2134 (dev): угсарсан «Миний багц» 20ml, collection_id null.
  it("VS-2134: угсарсан багц бүлэглэгдэнэ (custom), бэлэг доор", () => {
    const mine = (n: number, name: string) =>
      line({
        line_no: n,
        product_name: name,
        ml: 20,
        collection_name: "Миний багц",
      });
    const items = [
      line({
        line_no: 6,
        product_name: "Homme",
        ml: 1,
        qty: 2,
        is_gift: true,
        is_sample: true,
        list_price: 0,
        unit_price: 0,
      }),
      line({
        line_no: 5,
        product_name: "My Way",
        ml: 1,
        qty: 2,
        is_gift: true,
        is_sample: true,
        list_price: 0,
        unit_price: 0,
      }),
      mine(2, "Blooming"),
      mine(1, "Absolu"),
      mine(4, "Lazy"),
      mine(3, "Blanche"),
    ];
    const lines = buildOrderLines(items, base);
    expect(lines.map(label)).toEqual([
      "[custom Миний багц 20ml ×1: Absolu, Blooming, Blanche, Lazy]",
      "My Way 1 (gift)",
      "Homme 1 (gift)",
    ]);
    expect(bundleTitle(lines[0] as { name: string })).toBe("Миний багц");
    expectGrossPreserved(items, base);
  });

  it("ижил ml-тэй хоёр угсарсан багцыг line_no-гийн тасралт / давтагдсан бараагаар салгана", () => {
    const mine = (n: number, name: string, qty = 1) =>
      line({
        line_no: n,
        product_name: name,
        product_id: name,
        ml: 5,
        qty,
        collection_name: "Миний багц",
      });
    const gap = [
      mine(1, "A"),
      mine(2, "B"),
      line({ line_no: 3, product_name: "Solo", ml: 5 }),
      mine(4, "C"),
      mine(5, "D"),
    ];
    expect(buildOrderLines(gap, base).map(label)).toEqual([
      "Solo 5",
      "[custom Миний багц 5ml ×1: A, B]",
      "[custom Миний багц 5ml ×1: C, D]",
    ]);
    const repeat = [mine(1, "A"), mine(2, "B"), mine(3, "A"), mine(4, "C")];
    expect(buildOrderLines(repeat, base).map(label)).toEqual([
      "[custom Миний багц 5ml ×1: A, B]",
      "[custom Миний багц 5ml ×1: A, C]",
    ]);
    const qty = [mine(1, "A"), mine(2, "B"), mine(3, "C", 2), mine(4, "D", 2)];
    expect(buildOrderLines(qty, base).map(label)).toEqual([
      "[custom Миний багц 5ml ×1: A, B]",
      "[custom Миний багц 5ml ×2: C, D]",
    ]);
  });

  // VS-2139 (dev): хүрдний шагнал = бүтэн GENTLEMAN багц (бэлэг, spin_id).
  it("VS-2139: хүрдний шагналын багц бэлгийн хэсэгт, сарын бэлгээс өмнө", () => {
    const spin = (name: string) =>
      line({
        product_name: name,
        ml: 2,
        collection_id: "gentleman",
        collection_name: "Азын хүрдний шагнал · GENTLEMAN",
        is_gift: true,
        spin_id: "spin-1",
        list_price: 0,
        unit_price: 0,
      });
    const items = [
      line({
        product_name: "Sample",
        ml: 1,
        is_gift: true,
        is_sample: true,
        list_price: 0,
        unit_price: 0,
      }),
      spin("Layton"),
      spin("Bleu"),
      line({
        line_no: 1,
        product_name: "Ombre",
        ml: 2,
        list_price: 22000,
        unit_price: 22000,
      }),
    ];
    const lines = buildOrderLines(items, base);
    expect(lines.map(label)).toEqual([
      "Ombre 2",
      "[gift base Азын хүрдний шагнал · GENTLEMAN 2ml ×1: Layton, Bleu]",
      "Sample 1 (gift)",
    ]);
    expect(bundleTitle(lines[1] as { name: string })).toBe(
      "Азын хүрдний шагнал · GENTLEMAN багц",
    );
    expectGrossPreserved(items, base);
  });

  // VS-1143 (dev): 0149-өөс өмнөх — line_no байхгүй.
  it("VS-1143: line_no-гүй хуучин захиалга id-аар тогтмол, нэр + ml-ээр бүлэглэнэ", () => {
    const items = [
      line({
        id: "c",
        product_name: "GIT",
        ml: 20,
        collection_id: "creed",
        collection_name: "CREED",
      }),
      line({
        id: "e",
        product_name: "Polo",
        ml: 1,
        is_gift: true,
        list_price: 0,
        unit_price: 0,
      }),
      line({
        id: "a",
        product_name: "Absolu",
        ml: 20,
        collection_id: "creed",
        collection_name: "CREED",
      }),
      line({
        id: "b",
        product_name: "Aventus",
        ml: 20,
        collection_id: "creed",
        collection_name: "CREED",
      }),
      line({
        id: "d",
        product_name: "Mine1",
        ml: 5,
        collection_name: "Миний багц",
      }),
      line({
        id: "f",
        product_name: "Mine2",
        ml: 5,
        collection_name: "Миний багц",
      }),
    ];
    const once = buildOrderLines(items, base).map(label);
    expect(once).toEqual([
      "[custom Миний багц 5ml ×1: Mine1, Mine2]",
      "[base CREED 20ml ×1: Absolu, Aventus, GIT]",
      "Polo 1 (gift)",
    ]);
    // Оролтын дараалал өөр байсан ч ижил үр дүн.
    expect(buildOrderLines([...items].reverse(), base).map(label)).toEqual(
      once,
    );
    expectGrossPreserved(items, base);
  });

  it("list_price-гүй хуучин мөр unit_price-аар", () => {
    const items = [
      line({
        line_no: 1,
        ml: 5,
        list_price: null,
        unit_price: 20000,
        qty: 2,
        collection_id: "gentleman",
        collection_name: "GENTLEMAN",
      }),
    ];
    expect(buildOrderLines(items, base)[0]).toMatchObject({ base: 40000 });
  });
});
