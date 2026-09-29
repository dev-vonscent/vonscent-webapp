// @vitest-environment jsdom
import Autoplay from "embla-carousel-autoplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GALLERY_AUTOPLAY } from "./gallery-autoplay";

/**
 * Embla-г jsdom дээр layout-гүйгээр ажиллуулах боломжгүй тул autoplay
 * plugin-ийг бидний сонголтоор, хуурамч embla API дээр шууд ажиллуулна —
 * алдаа нь plugin-ийн сонголтын хослолд байсан (hover = бүрмөсөн зогсох).
 */
function fakeEmbla() {
  const root = document.createElement("div");
  const container = document.createElement("div");
  root.appendChild(container);
  const handlers = new Map<string, Set<() => void>>();
  const api = {
    rootNode: () => root,
    containerNode: () => container,
    scrollSnapList: () => [0, 1, 2],
    selectedScrollSnap: () => 0,
    canScrollNext: () => true,
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    emit: vi.fn(),
    on(evt: string, cb: () => void) {
      if (!handlers.has(evt)) handlers.set(evt, new Set());
      handlers.get(evt)!.add(cb);
      return api;
    },
    off(evt: string, cb: () => void) {
      handlers.get(evt)?.delete(cb);
      return api;
    },
    fire(evt: string) {
      handlers.get(evt)?.forEach((cb) => cb());
    },
    internalEngine: () => ({
      eventStore: {
        add: (node: EventTarget, type: string, cb: EventListener) =>
          node.addEventListener(type, cb),
      },
      ownerDocument: document,
      ownerWindow: window,
      options: { watchDrag: true },
      index: { clone: () => ({ add: () => ({ get: () => 1 }) }) },
    }),
  };
  return { api, root };
}

function start() {
  const plugin = Autoplay(GALLERY_AUTOPLAY);
  const { api, root } = fakeEmbla();
  plugin.init(
    api as never,
    {
      mergeOptions: (a: object, b?: object) => ({ ...a, ...b }),
      optionsAtMedia: (o: object) => o,
    } as never,
  );
  return { plugin, api, root };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("product gallery autoplay", () => {
  it("plays on load", () => {
    const { plugin, api } = start();
    expect(plugin.isPlaying()).toBe(true);
    vi.advanceTimersByTime(GALLERY_AUTOPLAY.delay);
    expect(api.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("only pauses while hovered — resumes when the pointer leaves", () => {
    // Регресс: hover (утсан дээр товшилтын дуурайсан mouseenter) нь
    // autoplay-г БҮРМӨСӨН зогсоодог байсан — mouseleave сонсогдоогүй.
    const { plugin, root } = start();
    root.dispatchEvent(new MouseEvent("mouseenter"));
    expect(plugin.isPlaying()).toBe(false);
    root.dispatchEvent(new MouseEvent("mouseleave"));
    expect(plugin.isPlaying()).toBe(true);
  });

  it("resumes after a swipe", () => {
    const { plugin, api } = start();
    api.fire("pointerDown");
    expect(plugin.isPlaying()).toBe(false);
    api.fire("pointerUp");
    expect(plugin.isPlaying()).toBe(true);
  });
});
