import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Нэр" },
  {
    id: "actions",
    header: "Үйлдэл",
    cell: () => (
      <button type="button" onClick={() => actioned()}>
        Засах
      </button>
    ),
  },
];

const actioned = vi.fn();
const DATA: Row[] = [{ id: "c1", name: "Болд" }];

/**
 * The customer list only had a link on the name, which is a tiny target and
 * disappears entirely for a customer with no name («—»). `rowHref` makes the
 * whole row the target — the risk being that it swallows the controls sitting
 * inside the row, which is what these tests hold in place.
 */
describe("DataTable rowHref", () => {
  beforeEach(() => {
    push.mockClear();
    actioned.mockClear();
  });

  it("navigates when the row is clicked away from any control", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={DATA}
        pageSize={0}
        label="Жагсаалт"
        rowHref={(r) => `/admin/customers/${r.id}`}
      />,
    );
    await user.click(screen.getByText("Болд"));
    expect(push).toHaveBeenCalledWith("/admin/customers/c1");
  });

  it("leaves a control inside the row to its own handler", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={DATA}
        pageSize={0}
        label="Жагсаалт"
        rowHref={(r) => `/admin/customers/${r.id}`}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Засах" }));
    expect(actioned).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("stays put without rowHref", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={columns} data={DATA} pageSize={0} label="Жагсаалт" />,
    );
    await user.click(screen.getByText("Болд"));
    expect(push).not.toHaveBeenCalled();
  });
});
