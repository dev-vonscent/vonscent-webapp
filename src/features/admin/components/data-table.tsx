"use client";

import { useEffect, useId, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Columns declare `meta: { align: "right" }` for numeric data. Only the cells
 * ever honoured it, so a right-aligned figure sat under a left-aligned
 * heading — «Эхлэх үнэ» over a price flush to the far edge of the column read
 * as two different columns. The header and the cell now share one source.
 */
type ColumnAlign = "left" | "right";
function alignOf(meta: unknown): ColumnAlign {
  return (meta as { align?: ColumnAlign } | undefined)?.align === "right"
    ? "right"
    : "left";
}

/**
 * Shared admin table on @tanstack/react-table: client-side sorting on any
 * column with `enableSorting`, optional global text filter and pagination.
 * Server components fetch the rows; the column defs live in a per-page
 * client component because they contain render functions.
 */

/**
 * Tailwind's `md`. Used to render *either* the cards or the table — hiding one
 * with CSS mounted both, so `/admin/inventory` built two RestockControls per
 * row (two controlled inputs and a Dialog each) on the phone it was built for.
 */
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isPhone;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Placeholder → renders a search box doing a global contains-filter. */
  searchPlaceholder?: string;
  /** Rows per page; 0 disables pagination (default 20). */
  pageSize?: number;
  emptyText?: string;
  /** Accessible name for the table and its search box (WCAG 1.3.1 / 3.3.2). */
  label: string;
  /**
   * Optional phone layout. A table with 6+ columns can only scroll sideways on
   * a phone, which puts the last column's controls off-screen — so when this is
   * given, a phone renders cards instead of the table (one tree, not both).
   * Search and pagination are shared; the phone gets its own sort control,
   * since the sort buttons live in the table header it never renders.
   */
  renderCard?: (row: TData) => React.ReactNode;
  /**
   * Turn off the phone-only sort control. Set it when the page already owns
   * sorting — the products list sorts through the URL in its own toolbar, so
   * a phone was getting two «Эрэмбэ» dropdowns that sorted by different
   * mechanisms and disagreed with each other.
   */
  phoneSort?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 20,
  emptyText = "Мэдээлэл алга",
  label,
  renderCard,
  phoneSort = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const searchId = useId();
  const sortId = useId();
  const isPhone = useIsPhone();
  // Server-render the table: it is the complete markup, so a phone that never
  // reaches the effect still gets every row and every cell.
  const showCards = Boolean(renderCard) && isPhone;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize > 0
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
    globalFilterFn: "includesString",
  });

  const pageCount = table.getPageCount();
  const sortableColumns = table
    .getAllColumns()
    .filter((c) => c.getCanSort())
    .map((c) => ({
      id: c.id,
      label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
    }));
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const firstRow = pageIndex * currentPageSize;
  const lastRow = Math.min(firstRow + currentPageSize, filteredCount);

  return (
    <div className="space-y-3">
      {searchPlaceholder !== undefined && (
        <>
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
          </label>
          <input
            id={searchId}
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            // text-base on mobile, or iOS Safari zooms the page on focus.
            className="bg-secondary field-edge h-11 w-64 max-w-full rounded-md px-3 text-base md:h-9 md:text-sm"
          />
        </>
      )}

      {showCards && renderCard ? (
        <>
          {phoneSort && sortableColumns.length > 0 && (
            <div className="flex items-center gap-2">
              <span id={sortId} className="text-muted-foreground text-xs">
                Эрэмбэ
              </span>
              {/* The sort buttons live in the table header, which the phone
                  never renders — without this there is no way to sort at all.
                  A native <select> here drew the browser's own grey list on top
                  of a themed page; this is the same control as every other
                  dropdown in the panel. */}
              <Select
                value={
                  sorting[0]
                    ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
                    : "none"
                }
                onValueChange={(v) => {
                  if (v === "none") return setSorting([]);
                  const [id, dir] = v.split(":");
                  setSorting([{ id, desc: dir === "desc" }]);
                }}
              >
                <SelectTrigger aria-labelledby={sortId} className="h-11 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Эрэмбэлэхгүй</SelectItem>
                  {sortableColumns.map((c) => [
                    <SelectItem key={`${c.id}:asc`} value={`${c.id}:asc`}>
                      {c.label} — өсөхөөр
                    </SelectItem>,
                    <SelectItem key={`${c.id}:desc`} value={`${c.id}:desc`}>
                      {c.label} — буурахаар
                    </SelectItem>,
                  ])}
                </SelectContent>
              </Select>
            </div>
          )}
          {table.getRowModel().rows.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-lg py-10 text-center text-sm">
              {emptyText}
            </p>
          ) : (
            <ul role="list" aria-label={label} className="space-y-2">
              {table.getRowModel().rows.map((row) => (
                <li key={row.id}>
                  <Card className="p-4">{renderCard(row.original)}</Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Card className="overflow-hidden">
          <Table aria-label={label}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const dir = header.column.getIsSorted();
                    const align = alignOf(header.column.columnDef.meta);
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(align === "right" && "text-right")}
                        aria-sort={
                          !canSort
                            ? undefined
                            : dir === "asc"
                              ? "ascending"
                              : dir === "desc"
                                ? "descending"
                                : "none"
                        }
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "hover:text-foreground inline-flex items-center gap-1",
                              dir && "text-foreground",
                              // An inline-flex button inside a right-aligned
                              // cell still needs the cell's own alignment to
                              // push it over.
                              align === "right" && "justify-end",
                            )}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {dir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : dir === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground py-10 text-center"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  // `TableRow`'s `border-t` is dead — globals.css collapses every
                  // border to transparent — so rows are separated the way
                  // DESIGN.md prescribes: with the next colour layer.
                  <TableRow
                    key={row.id}
                    className="even:bg-muted/40 hover:bg-muted/70"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          alignOf(cell.column.columnDef.meta) === "right" &&
                            "text-right",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {pageSize > 0 && filteredCount > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          {/* The row total matters: without it a filter that matches 3 rows and
              one that matches 300 look identical from the page counter. */}
          <span className="text-muted-foreground">
            {filteredCount.toLocaleString("mn-MN")}-аас{" "}
            {(firstRow + 1).toLocaleString("mn-MN")}–
            {lastRow.toLocaleString("mn-MN")}
          </span>
          {pageCount > 1 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-11 md:h-9"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Өмнөх
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-11 md:h-9"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Дараах
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
