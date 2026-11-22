import { describe, expect, it } from "vitest";
import { fillTipTokens } from "./tip-tokens";

describe("fillTipTokens", () => {
  it("тохиргооны утгаар солино", () => {
    expect(
      fillTipTokens(
        "Мэдээллээ бөглөөд {profilePoints} Vpoint, сэтгэгдэл бүрээс {reviewPoints} Vpoint.",
        { profilePoints: 1000, reviewPoints: 500 },
      ),
    ).toBe("Мэдээллээ бөглөөд 1,000 Vpoint, сэтгэгдэл бүрээс 500 Vpoint.");
  });

  it("токенгүй текст хэвээр", () => {
    expect(
      fillTipTokens("Decant гэж юу вэ?", { profilePoints: 1, reviewPoints: 1 }),
    ).toBe("Decant гэж юу вэ?");
  });
});
