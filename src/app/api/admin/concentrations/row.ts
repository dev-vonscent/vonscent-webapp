import type { ConcentrationOption } from "@/lib/types";

/**
 * Shared shape for the two concentration routes (0085).
 *
 * Kept beside them rather than in `route.ts`: Next only allows route handlers
 * and route config to be exported from a `route.ts`, and both POST and
 * PATCH return the same row to a form that has to re-select it.
 */

export interface ConcentrationRowJson {
  id: string;
  code: string;
  label: string | null;
  sort_order: number;
  is_active: boolean;
}

export const CONCENTRATION_COLUMNS = "id, code, label, sort_order, is_active";

export function toConcentrationOption(
  row: ConcentrationRowJson,
): ConcentrationOption {
  return {
    id: row.id,
    code: row.code,
    label: row.label ?? "",
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
