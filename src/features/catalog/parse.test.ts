import { describe, expect, it } from "vitest";
import { parseFilters } from "./parse";

describe("parseFilters — featured (backlog C2)", () => {
  it("featured=1 / true → featured: true", () => {
    expect(parseFilters({ featured: "1" }).featured).toBe(true);
    expect(parseFilters({ featured: "true" }).featured).toBe(true);
  });
  it("бусад утга эсвэл байхгүй бол шүүлт тавихгүй", () => {
    expect(parseFilters({}).featured).toBeUndefined();
    expect(parseFilters({ featured: "0" }).featured).toBeUndefined();
    expect(parseFilters({ featured: ["1", "0"] }).featured).toBe(true);
  });
});

describe("parseFilters — «Багц»", () => {
  it("брэнд, үнэрийн төрөл, улирлыг хаяна (багцад байхгүй)", () => {
    const f = parseFilters({
      kind: "bundle",
      brand: "Dior",
      family: "woody",
      season: "winter",
      gender: "male",
    });
    expect(f).toMatchObject({ brand: [], family: [], season: [] });
    expect(f.gender).toEqual(["male"]);
  });

  it("ус болон бүгд дээр хэвээр", () => {
    expect(parseFilters({ season: "winter" }).season).toEqual(["winter"]);
    expect(parseFilters({ kind: "perfume", brand: "Dior" }).brand).toEqual([
      "Dior",
    ]);
  });
});

describe("parseFilters — арга хэмжээ (?event=, 0181)", () => {
  it("slug хэлбэртэй утгыг авна", () => {
    expect(parseFilters({ event: "black-friday" }).event).toBe("black-friday");
  });

  it("буруу хэлбэр / хоосон → undefined", () => {
    expect(parseFilters({ event: "Black Friday" }).event).toBeUndefined();
    expect(parseFilters({ event: "x" }).event).toBeUndefined();
    expect(parseFilters({ event: "" }).event).toBeUndefined();
    expect(parseFilters({}).event).toBeUndefined();
  });

  it("багц дээр хоосорно — туг хаалттай (өгөгдмөл) үед өмнөх шиг", () => {
    expect(
      parseFilters({ kind: "bundle", event: "black-friday" }).event,
    ).toBeUndefined();
    expect(
      parseFilters(
        { kind: "bundle", event: "black-friday" },
        { bundleEvents: false },
      ).event,
    ).toBeUndefined();
  });

  it("туг sale_event_bundles нээлттэй → «Багц» таб дээр ч хадгалагдана (16.7)", () => {
    expect(
      parseFilters(
        { kind: "bundle", event: "black-friday" },
        { bundleEvents: true },
      ).event,
    ).toBe("black-friday");
    // Бусад «Багц»-ийн дүрэм хэвээр (брэнд хоосорно).
    expect(
      parseFilters(
        { kind: "bundle", event: "black-friday", brand: "Dior" },
        { bundleEvents: true },
      ).brand,
    ).toEqual([]);
  });
});
