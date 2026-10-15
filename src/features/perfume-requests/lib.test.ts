import { describe, expect, it } from "vitest";
import { splitSearchQuery } from "./lib";

describe("splitSearchQuery", () => {
  const brands = ["Dior", "Maison", "Maison Margiela", "Tom Ford"];

  it("эхний брэндийг салгана, том жижиг үсэг хамаагүй", () => {
    expect(splitSearchQuery(" dior  sauvage ", brands)).toEqual({
      brand: "Dior",
      name: "sauvage",
    });
  });

  it("хамгийн урт брэнд түрүүлнэ", () => {
    expect(splitSearchQuery("maison margiela replica", brands)).toEqual({
      brand: "Maison Margiela",
      name: "replica",
    });
  });

  it("үгийн дундуур тасдахгүй", () => {
    expect(splitSearchQuery("diorama", brands)).toEqual({
      brand: "",
      name: "diorama",
    });
  });

  it("зөвхөн брэнд бичсэн бол нэр хоосон", () => {
    expect(splitSearchQuery("Tom Ford", brands)).toEqual({
      brand: "Tom Ford",
      name: "",
    });
  });

  it("брэнд олдохгүй бол бүгд нэр", () => {
    expect(splitSearchQuery("Baccarat Rouge", brands)).toEqual({
      brand: "",
      name: "Baccarat Rouge",
    });
  });
});
