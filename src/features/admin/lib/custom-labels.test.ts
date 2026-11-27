import { describe, expect, it } from "vitest";
import {
  ADDRESS_COLUMNS,
  PERFUME_COLUMNS,
  isBlank,
  matchHeader,
  parseBool,
  parseDelimited,
  parseMl,
  parseQty,
  tableToValues,
} from "./custom-labels";

describe("parseDelimited", () => {
  it("Excel-ийн tab-тай хуулбар", () => {
    expect(parseDelimited("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("хашилттай нүд — мөр шилжилт, хос хашилт, тусгаарлагч", () => {
    expect(parseDelimited('"1-р\nдавхар","say ""hi""",x\n,,\ny,z')).toEqual([
      ["1-р\nдавхар", 'say "hi"', "x"],
      ["y", "z"],
    ]);
  });

  it("`;`-ээр тусгаарласан CSV, BOM", () => {
    expect(parseDelimited("﻿Нэр;Утас\nБолд;9911")).toEqual([
      ["Нэр", "Утас"],
      ["Болд", "9911"],
    ]);
  });
});

describe("matchHeader", () => {
  it("«Утасны дугаар» → утас, «Захиалгын дугаар» алгасагдана", () => {
    expect(
      matchHeader(
        ["Захиалгын дугаар", "Утасны дугаар", "Хүлээн авагчийн нэр", "?"],
        ADDRESS_COLUMNS,
        "address",
      ),
    ).toEqual([null, "phone", "name", null]);
  });

  it("«Брэндийн нэр» → брэнд", () => {
    expect(
      matchHeader(
        ["Брэндийн нэр", "Үнэртэн", "ML"],
        PERFUME_COLUMNS,
        "perfume",
      ),
    ).toEqual(["brand", "name", "ml"]);
  });

  it("өгөгдлийн мөр толгой биш", () => {
    expect(
      matchHeader(["Болд", "99112233", "БЗД"], ADDRESS_COLUMNS, "address"),
    ).toBeNull();
  });
});

describe("tableToValues", () => {
  it("толгойтой — баганын дараалал хамаагүй, хоосон мөр хасагдана", () => {
    const rows = tableToValues(
      [
        ["Утас", "Нэр", "Бэлгийн боолт", "Хаяг"],
        ["9911", "Болд", "тийм", "БЗД"],
        ["", "", "x", ""],
        ["8800", "Сараа", "", "ХУД"],
      ],
      ADDRESS_COLUMNS,
      "address",
    );
    expect(rows).toEqual([
      {
        name: "Болд",
        phone: "9911",
        address: "БЗД",
        note: "",
        remote: "",
        giftWrap: "1",
      },
      {
        name: "Сараа",
        phone: "8800",
        address: "ХУД",
        note: "",
        remote: "",
        giftWrap: "",
      },
    ]);
  });

  it("толгойгүй — буулгасан нүднээс эхлэн хүснэгтийн дарааллаар", () => {
    const [row] = tableToValues(
      [["Болд", "9911", "БЗД"]],
      ADDRESS_COLUMNS,
      "address",
      1,
    );
    expect(row).toMatchObject({
      name: "",
      phone: "Болд",
      address: "9911",
      note: "БЗД",
    });
    const [fromStart] = tableToValues(
      [["Болд", "9911", "БЗД"]],
      ADDRESS_COLUMNS,
      "address",
    );
    expect(fromStart).toMatchObject({
      name: "Болд",
      phone: "9911",
      address: "БЗД",
    });
  });
});

describe("жижиг задлагч", () => {
  it("parseBool", () => {
    expect(["1", "Тийм", "x", "✓", "TRUE"].map(parseBool)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(["", "0", "үгүй", "false"].map(parseBool)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("parseMl", () => {
    expect(parseMl("5ml")).toBe(5);
    expect(parseMl("10 мл")).toBe(10);
    expect(parseMl("")).toBeNull();
  });

  it("parseQty: хоосон 1, 1–99", () => {
    expect(parseQty("")).toBe(1);
    expect(parseQty("3")).toBe(3);
    expect(parseQty("0")).toBe(1);
    expect(parseQty("500")).toBe(99);
  });

  it("isBlank checkbox-ыг тооцохгүй", () => {
    expect(
      isBlank({ brand: "", name: " ", ml: "", qty: "" }, PERFUME_COLUMNS),
    ).toBe(true);
  });
});
