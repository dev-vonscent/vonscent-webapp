import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const back = vi.fn();
const nav = { pathname: "/admin/orders", search: "status=confirmed&page=2" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// Модулийн түвшний төлөвтэй тул тест бүр шинээр ачаална.
async function load() {
  vi.resetModules();
  return import("./back-link");
}

/** Tracker-ийг URL-уудаар дамжуулж, эцэст нь BackLink-ийг зурна. */
async function visit(urls: [string, string][], href: string) {
  const { AdminNavTracker, BackLink } = await load();
  const tracker = render(<AdminNavTracker />);
  for (const [p, s] of urls) {
    nav.pathname = p;
    nav.search = s;
    tracker.rerender(<AdminNavTracker />);
  }
  render(<BackLink href={href}>Буцах</BackLink>);
  return screen.getByRole("link", { name: "Буцах" });
}

describe("BackLink", () => {
  beforeEach(() => back.mockClear());

  it("returns through history when the list was the previous page", async () => {
    const link = await visit(
      [
        ["/admin/orders", "status=confirmed&page=2"],
        ["/admin/orders/abc", ""],
      ],
      "/admin/orders",
    );
    fireEvent.click(link);
    expect(back).toHaveBeenCalledOnce();
  });

  it("falls back to the href when arriving from elsewhere", async () => {
    const link = await visit(
      [
        ["/admin/customers/1", ""],
        ["/admin/orders/abc", ""],
      ],
      "/admin/orders",
    );
    fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
    expect(link).toHaveAttribute("href", "/admin/orders");
  });

  it("leaves modified clicks (new tab) to the browser", async () => {
    const link = await visit(
      [
        ["/admin/orders", ""],
        ["/admin/orders/abc", ""],
      ],
      "/admin/orders",
    );
    fireEvent.click(link, { metaKey: true });
    expect(back).not.toHaveBeenCalled();
  });
});
