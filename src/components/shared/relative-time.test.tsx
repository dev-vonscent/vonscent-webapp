import * as React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelativeTime } from "./relative-time";

const ISO = "2026-09-08T03:00:00Z";

describe("RelativeTime", () => {
  it("сервер тогтмол огноо бичнэ — ISR HTML цаг өнгөрөхөд өөрчлөгдөхгүй", () => {
    const html = renderToString(<RelativeTime value={ISO} />);
    expect(html).toContain("2026.09.08");
    expect(html).not.toContain("өмнө");
  });

  it("hydration mismatch-гүй, дараа нь харьцаангуй хугацаа руу шилжинэ", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<RelativeTime value={ISO} />);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <RelativeTime value={ISO} />, {
        onRecoverableError,
      });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    const time = container.querySelector("time")!;
    expect(time.textContent).toContain("өмнө");
    expect(time.getAttribute("dateTime")).toBe(ISO);
    expect(time.getAttribute("title")).toBe("2026.09.08");
  });
});
