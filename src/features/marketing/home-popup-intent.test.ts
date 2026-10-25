// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearHomePopupIntent,
  hasHomePopupIntent,
  markHomePopupIntent,
} from "./home-popup-intent";

function at(pathname: string) {
  window.history.replaceState(null, "", pathname);
}

afterEach(() => {
  clearHomePopupIntent();
  vi.useRealTimers();
  at("/");
});

describe("home popup intent (клиент, 2026-10-26)", () => {
  it("is off until the logo / home icon is pressed", () => {
    expect(hasHomePopupIntent()).toBe(false);
  });

  it("is set by a press from another page, and cleared once used", () => {
    at("/products/x");
    markHomePopupIntent();
    expect(hasHomePopupIntent()).toBe(true);
    clearHomePopupIntent();
    expect(hasHomePopupIntent()).toBe(false);
  });

  it("ignores a press on the home page itself — a later back must not open it", () => {
    at("/");
    markHomePopupIntent();
    expect(hasHomePopupIntent()).toBe(false);
  });

  it("expires, so a stale press doesn't fire on a much later back", () => {
    vi.useFakeTimers();
    at("/catalog");
    markHomePopupIntent();
    vi.advanceTimersByTime(11_000);
    expect(hasHomePopupIntent()).toBe(false);
  });
});
