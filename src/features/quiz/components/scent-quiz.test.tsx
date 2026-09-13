import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScentQuiz } from "./scent-quiz";
import { QUIZ_QUESTIONS } from "../questions";

// The rail itself is covered by the carousel's own tests; here it only has to
// render without pulling in images and a router.
vi.mock("@/features/products/components/product-carousel", () => ({
  ProductCarousel: () => <div data-testid="rail" />,
}));

const ANSWERS_KEY = "vonscent:quiz-answers";

/** One valid answer per question — what a finished quiz leaves behind. */
const completePicks = Object.fromEntries(
  QUIZ_QUESTIONS.map((q) => [q.id, q.options[0].id]),
);

function mockQuizApi() {
  const fetchMock = vi.fn(
    async (url: string, init?: RequestInit) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ items: [], fallback: false, url, init }),
      }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A finished quiz in storage, so the widget lands straight on the results. */
function restoreWith(result: { items: unknown[]; fallback: boolean }) {
  sessionStorage.setItem(
    ANSWERS_KEY,
    JSON.stringify({ gender: "any", picks: completePicks }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => result,
        }) as unknown as Response,
    ),
  );
}

describe("ScentQuiz answer persistence", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("returns to the results when the tab already holds a finished quiz", async () => {
    // The visitor opened a recommendation and pressed back: the widget
    // remounts, and must not drop them at the intro.
    sessionStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({ gender: "male", picks: completePicks }),
    );
    const fetchMock = mockQuizApi();

    render(<ScentQuiz />);

    await waitFor(() =>
      expect(screen.getByText("Танд тохирох үнэртнүүд")).toBeInTheDocument(),
    );
    // Matches are re-fetched rather than restored: prices and stock move.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.gender).toBe("male");
    expect(body.picks).toEqual(Object.values(completePicks));
  });

  it("ignores a half-finished or malformed stored quiz", async () => {
    const partial = { ...completePicks };
    delete partial[QUIZ_QUESTIONS[0].id];
    sessionStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({ gender: "any", picks: partial }),
    );
    const fetchMock = mockQuizApi();

    render(<ScentQuiz />);

    expect(await screen.findByText("Үнэрээ ол")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ScentQuiz results with nothing to match", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("offers the catalogue when the rail is only a fallback", async () => {
    // No profile is being expressed here, so «Дахин эхлэх» must not be the
    // only way out.
    restoreWith({ items: [], fallback: true });
    render(<ScentQuiz />);
    expect(await screen.findByText("Каталогоос үзэх")).toHaveAttribute(
      "href",
      "/catalog",
    );
  });

  it("keeps the results clean when the match is a real one", async () => {
    restoreWith({ items: [{ id: "a" }], fallback: false });
    render(<ScentQuiz />);
    await screen.findByText("Танд тохирох үнэртнүүд");
    expect(screen.queryByText("Каталогоос үзэх")).not.toBeInTheDocument();
  });
});
