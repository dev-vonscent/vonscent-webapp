import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useConfirm, type ConfirmOptions } from "./confirm-dialog";

function Harness({
  options,
  onResult,
}: {
  options: ConfirmOptions;
  onResult: (ok: boolean) => void;
}) {
  const [confirm, dialog] = useConfirm();
  return (
    <>
      {dialog}
      <button onClick={async () => onResult(await confirm(options))}>
        open
      </button>
    </>
  );
}

describe("useConfirm action", () => {
  it("stays open with a busy button until the action finishes", async () => {
    let finish!: () => void;
    const action = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    const results: boolean[] = [];
    render(
      <Harness
        options={{ title: "Цуцлах уу?", confirmLabel: "Цуцлах", action }}
        onResult={(ok) => results.push(ok)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "open" }));
    const confirmBtn = await screen.findByRole("button", { name: "Цуцлах" });
    await userEvent.click(confirmBtn);

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(confirmBtn.getAttribute("aria-busy")).toBe("true");
    expect(confirmBtn.hasAttribute("disabled")).toBe(true);
    // Escape мэт «болих» нь ажил явж байхад цонхыг хаахгүй.
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(results).toEqual([true]);
  });

  it("closes at once when there is no action", async () => {
    const results: boolean[] = [];
    render(
      <Harness
        options={{ title: "Устгах уу?" }}
        onResult={(ok) => results.push(ok)}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(await screen.findByRole("button", { name: "Тийм" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(results).toEqual([true]);
  });
});
