import { describe, expect, it } from "vitest";
import { computeHeroAssets } from "../../../scripts/hero-assets";
import HERO_ASSETS from "./hero-assets.json";

/**
 * `/hero/*`, `/models/*` нь 1 жилийн immutable кэштэй — URL-ийн `?v=` нь
 * файлын агуулгатай таарахгүй бол хэрэглэгчид хуучин poster/загвар үлдэнэ.
 */
describe("hero-assets.json", () => {
  it("public/hero, public/models-ийн одоогийн агуулгатай таарна", () => {
    expect(
      HERO_ASSETS,
      "Hero файл өөрчлөгдсөн — `pnpm hero:assets` ажиллуул",
    ).toEqual(computeHeroAssets());
  });
});
