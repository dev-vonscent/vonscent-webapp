import { describe, expect, it } from "vitest";
import { STORE_NAV_PRIMARY, isNavActive, visibleNavItems } from "./store-nav";

describe("isNavActive — «Үнэртний шил», «Дагалдах хэрэгсэл»", () => {
  it("өөрийн хуудсан дээр тодорч «Каталог» унтарна", () => {
    for (const href of ["/bottles", "/accessories"]) {
      expect(isNavActive(href, href)).toBe(true);
      expect(isNavActive("/catalog", href)).toBe(false);
    }
    expect(isNavActive("/bottles", "/accessories")).toBe(false);
  });

  it("каталог дээр тодрохгүй", () => {
    expect(isNavActive("/catalog", "/catalog")).toBe(true);
    expect(isNavActive("/bottles", "/catalog")).toBe(false);
  });
});

describe("visibleNavItems", () => {
  it("extras_shop хаалттай үед хоёр мөр харагдахгүй", () => {
    const hrefs = visibleNavItems(STORE_NAV_PRIMARY, new Set()).map(
      (i) => i.href,
    );
    expect(hrefs).not.toContain("/bottles");
    expect(hrefs).not.toContain("/accessories");
    expect(hrefs).toContain("/catalog");
  });

  it("extras_shop асаалттай үед «Үнэртний шил»-ийн дараа «Дагалдах хэрэгсэл»", () => {
    const hrefs = visibleNavItems(
      STORE_NAV_PRIMARY,
      new Set(["extras_shop"]),
    ).map((i) => i.href);
    expect(hrefs.slice(-2)).toEqual(["/bottles", "/accessories"]);
  });
});
