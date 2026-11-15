import { describe, expect, it } from "vitest";
import { HERO_LIMITS as L } from "@/lib/constants";
import { defaultHeroCopy, monthDay } from "./default-copy";

const base = {
  name: "Black Friday",
  headline: "",
  slug: "black-friday",
  startsOn: "2026-11-23",
  endsOn: "2026-11-30",
  maxPct: 30,
};

describe("monthDay", () => {
  it("«11/23», хоосон бол хоосон", () => {
    expect(monthDay("2026-01-05")).toBe("1/5");
    expect(monthDay("")).toBe("");
  });
});

describe("defaultHeroCopy", () => {
  it("хувьтай арга хэмжээ", () => {
    expect(defaultHeroCopy(base)).toEqual({
      eyebrow: "Black Friday · 11/23–11/30",
      title: "Black Friday",
      description: "Сонгосон үнэртнүүд 30% хүртэл хямдарлаа. 11/30 хүртэл.",
      mobileDescription: "30% хүртэл хямдрал",
      primaryLabel: "Хямдралыг үзэх",
      primaryTarget: { type: "event", slug: "black-friday" },
      secondaryLabel: "",
      secondaryTarget: null,
    });
  });

  it("хувьгүй «сонголт» арга хэмжээ", () => {
    const c = defaultHeroCopy({ ...base, maxPct: null });
    expect(c.description).toBe("Энэ удаагийн онцгой сонголттой танилцаарай.");
    expect(c.mobileDescription).toBe("");
    expect(c.primaryLabel).toBe("Сонголтыг үзэх");
  });

  it("headline байвал гарчиг нь тэр", () => {
    expect(defaultHeroCopy({ ...base, headline: " Жилийн том хямдрал " }).title).toBe(
      "Жилийн том хямдрал",
    );
  });

  it("урт нэр: дээд мөрөнд зөвхөн огноо, гарчиг 48-д тайрна", () => {
    const name = "Эрэгтэйчүүдийн баярын онцгой үнэртнүүдийн долоо хоног 2026";
    const c = defaultHeroCopy({ ...base, name });
    expect(c.eyebrow).toBe("11/23–11/30");
    expect(c.title.length).toBeLessThanOrEqual(L.title);
    expect(name.startsWith(c.title)).toBe(true);
  });

  it("ганц өдөр, огноогүй", () => {
    expect(defaultHeroCopy({ ...base, endsOn: "2026-11-23" }).eyebrow).toBe(
      "Black Friday · 11/23",
    );
    const c = defaultHeroCopy({ ...base, startsOn: "", endsOn: "" });
    expect(c.eyebrow).toBe("Black Friday");
    expect(c.description).toBe("Сонгосон үнэртнүүд 30% хүртэл хямдарлаа.");
  });
});
