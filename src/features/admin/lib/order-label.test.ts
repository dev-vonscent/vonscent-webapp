import { describe, expect, it } from "vitest";
import {
  GIFT_WRAP_NOTE,
  orderLabelLines,
  perfumeLabelLayout,
  wrapSegments,
  wrapText,
  type OrderLabelLine,
  type OrderLabelSource,
} from "./order-label";

const base: OrderLabelSource = {
  order_no: "VS-1453",
  contact_name: " Бат ",
  contact_phone: "80023759",
  ship_city: "Улаанбаатар",
  ship_district: "СБД",
  ship_detail: "1-р хороо, 5-р байр 12 тоот",
  ship_zone: "Төв",
  note: "  Орцны код 1234 ",
};

describe("orderLabelLines", () => {
  const text = (l: OrderLabelLine) =>
    l.segments.map((s) => (s.bold ? `*${s.text}*` : s.text)).join(" ");

  it("number alone; field names bold, values plain", () => {
    expect(orderLabelLines(base).map(text)).toEqual([
      "*VS-1453*",
      "*Нэр:* Бат",
      "*Утас:* 80023759",
      "*Хаяг:* Улаанбаатар, СБД, 1-р хороо, 5-р байр 12 тоот",
      "*Тэмдэглэл:* Орцны код 1234",
    ]);
  });

  it("labels a countryside address «Орон нутаг»", () => {
    const lines = orderLabelLines(
      {
        ...base,
        ship_city: "Дархан-Уул",
        ship_district: "Дархан",
        ship_detail: "Унаа: Дархан автовокзал",
      },
      { remote: true },
    );
    expect(lines.map(text)[3]).toBe(
      "*Орон нутаг:* Дархан-Уул, Дархан, Унаа: Дархан автовокзал",
    );
  });

  it("skips empty district, zone and note", () => {
    const lines = orderLabelLines({
      ...base,
      ship_district: null,
      ship_zone: " ",
      note: "  ",
    });
    expect(lines.map(text)).toEqual([
      "*VS-1453*",
      "*Нэр:* Бат",
      "*Утас:* 80023759",
      "*Хаяг:* Улаанбаатар, 1-р хороо, 5-р байр 12 тоот",
    ]);
  });

  it("puts only a gift icon on the order-number line for gift wrap", () => {
    const lines = orderLabelLines(base, { giftWrap: true });
    expect(lines[0]).toEqual({
      icon: "gift",
      segments: [{ text: "VS-1453", bold: true }],
    });
    expect(lines).toHaveLength(5);
  });

  it("turns the free gift-wrap chip into the gift line, not a note", () => {
    const lines = orderLabelLines({
      ...base,
      note: `${GIFT_WRAP_NOTE} — Орцны код 1234`,
    });
    expect(lines[0].icon).toBe("gift");
    expect(lines.map(text).at(-1)).toBe("*Тэмдэглэл:* Орцны код 1234");

    const only = orderLabelLines({ ...base, note: GIFT_WRAP_NOTE });
    expect(only[0].icon).toBe("gift");
    expect(only.map(text).some((t) => t.includes("Тэмдэглэл"))).toBe(false);
  });

  it("manual label: no number line unless gift wrap; blank fields dropped", () => {
    const manual = { ...base, order_no: " ", contact_name: "", note: null };
    expect(orderLabelLines(manual).map(text)).toEqual([
      "*Утас:* 80023759",
      "*Хаяг:* Улаанбаатар, СБД, 1-р хороо, 5-р байр 12 тоот",
    ]);
    expect(orderLabelLines(manual, { giftWrap: true })[0]).toEqual({
      icon: "gift",
      segments: [],
    });
  });
});

describe("wrapSegments", () => {
  const measure = (s: string) => s.length;

  it("keeps each word's weight across lines", () => {
    expect(
      wrapSegments(
        [
          { text: "Хаяг:", bold: true },
          { text: "aa bb cc", bold: false },
        ],
        9,
        measure,
      ),
    ).toEqual([
      [
        { text: "Хаяг:", bold: true },
        { text: "aa", bold: false },
      ],
      [
        { text: "bb", bold: false },
        { text: "cc", bold: false },
      ],
    ]);
  });

  it("reserves the indent on the first line only", () => {
    expect(
      wrapSegments([{ text: "aa bb", bold: true }], 5, measure, 3).map((l) =>
        l.map((s) => s.text),
      ),
    ).toEqual([["aa"], ["bb"]]);
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length;

  it("wraps on words", () => {
    expect(wrapText("aa bb cc dd", 5, measure)).toEqual(["aa bb", "cc dd"]);
  });

  it("breaks a word longer than the line", () => {
    expect(wrapText("abcdefg h", 3, measure)).toEqual(["abc", "def", "g h"]);
  });

  it("keeps explicit line breaks", () => {
    expect(wrapText("a\nb", 10, measure)).toEqual(["a", "b"]);
  });
});

describe("perfumeLabelLayout", () => {
  // 1 тэмдэгт = px пиксел — хэмжилтийг урьдчилан тооцоолж болно.
  const measure = (s: string, px: number) => s.length * px;
  const base = {
    maxWidth: 100,
    maxHeight: 100,
    startPx: 10,
    lineGap: 1,
    ruleHeight: 0,
    brandRatio: 0.7,
    measure,
  };

  it("keeps the brand smaller than the name", () => {
    const l = perfumeLabelLayout({ ...base, brand: "Dior", name: "Sauvage" });
    expect(l).toEqual({ brandPx: 7, namePx: 10, nameLines: ["Sauvage"] });
  });

  it("wraps a long name to two lines before shrinking", () => {
    const l = perfumeLabelLayout({
      ...base,
      brand: "Dior",
      name: "Sauvage Elixir",
    });
    expect(l.namePx).toBe(10);
    expect(l.nameLines).toEqual(["Sauvage", "Elixir"]);
  });

  it("shrinks a brand that does not fit one line", () => {
    const l = perfumeLabelLayout({
      ...base,
      brand: "Maison Francis Kurkdjian",
      name: "Baccarat",
    });
    expect(measure("Maison Francis Kurkdjian", l.brandPx)).toBeLessThanOrEqual(
      100,
    );
    expect(l.brandPx).toBeLessThan(l.namePx);
  });

  it("never exceeds three lines and fits the height with the rule", () => {
    const l = perfumeLabelLayout({
      ...base,
      maxHeight: 25,
      ruleHeight: 3,
      brand: "Dior",
      name: "a b c d e f g h i j k l m n o p",
    });
    expect(l.nameLines.length).toBeLessThanOrEqual(2);
    expect(l.brandPx + l.nameLines.length * l.namePx + 3).toBeLessThanOrEqual(
      25,
    );
  });
});
