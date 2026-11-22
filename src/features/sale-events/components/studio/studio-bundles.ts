import { dayEndIso, dayStartIso } from "@/features/admin/lib/date-range";
import {
  bundleIssue,
  bundleLock,
  type SaleEventBundleOption,
} from "../../bundles";
import type { StudioDraft } from "./studio-model";

/**
 * Студийн бэлэн багцын төлөв (16.7) — checklist ба ②-ын хаалга. React-гүй.
 */
export function bundleChecklistState(
  draft: Pick<StudioDraft, "collections" | "startsOn" | "endsOn">,
  options: readonly SaleEventBundleOption[],
  ctx: { eventId: string | null; now: number },
): {
  count: number;
  issues: { name: string; issue: string }[];
  locked: { name: string; event: string }[];
} {
  const byId = new Map(options.map((o) => [o.id, o]));
  const period = draftPeriod(draft);
  const issues: { name: string; issue: string }[] = [];
  const locked: { name: string; event: string }[] = [];
  for (const b of draft.collections ?? []) {
    const option = byId.get(b.collectionId);
    const name = option?.name ?? "Нуусан / устгасан багц";
    const issue = bundleIssue(b, option);
    if (issue) issues.push({ name, issue });
    if (option) {
      const lock = bundleLock(option, { ...ctx, ...period });
      if (lock.locked) locked.push({ name, event: lock.locked.name });
    }
  }
  return { count: draft.collections?.length ?? 0, issues, locked };
}

/** Ноорогийн хугацаа ISO-оор (exclusive end) — сонгоогүй бол null. */
export function draftPeriod(d: Pick<StudioDraft, "startsOn" | "endsOn">): {
  startsAt: string | null;
  endsAt: string | null;
} {
  return {
    startsAt: d.startsOn ? dayStartIso(d.startsOn) : null,
    endsAt: d.endsOn ? dayEndIso(d.endsOn) : null,
  };
}

/** ②-оос цааш явахыг хориглох шалтгаан (багц) — бүгд зөв бол null. */
export function bundlesStepBlock(
  state: ReturnType<typeof bundleChecklistState> | null,
): string | null {
  if (!state) return null;
  const first = state.issues[0];
  if (first) return `«${first.name}» багц: ${first.issue}.`;
  const lock = state.locked[0];
  if (lock) return `«${lock.name}» багц «${lock.event}» арга хэмжээнд байна.`;
  return null;
}
