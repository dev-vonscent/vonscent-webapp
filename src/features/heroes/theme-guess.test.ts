import { describe, expect, it } from "vitest";
import { guessHeroTheme } from "./theme-guess";

describe("guessHeroTheme", () => {
  it("нэрээс", () => {
    expect(guessHeroTheme("Black Friday 2026", "")).toBe("black_friday");
    expect(guessHeroTheme("Цагаан сарын хямдрал", "")).toBe("tsagaan_sar");
    expect(guessHeroTheme("Эрэгтэйчүүдийн баяр", "")).toBe("mens_day");
    expect(guessHeroTheme("Наадам", "")).toBe("naadam");
  });
  it("таарахгүй бол эхлэх өдрийн улирал", () => {
    expect(guessHeroTheme("Туршилт", "2026-04-10")).toBe("spring");
    expect(guessHeroTheme("Туршилт", "2026-07-01")).toBe("summer");
    expect(guessHeroTheme("Туршилт", "2026-10-01")).toBe("autumn");
    expect(guessHeroTheme("Туршилт", "2026-01-15")).toBe("winter");
    expect(guessHeroTheme("Туршилт", "")).toBe("winter");
  });
});
