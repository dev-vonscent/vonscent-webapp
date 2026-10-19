import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { UB_TIMEZONE } from "@/lib/time";
import type { BroadcastAdminRow } from "./broadcast-types";

/** Хуваарийн цагийн сонголтууд — 30 минутын алхамтай («09:00», «09:30» …). */
export const SCHEDULE_TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

/** УБ-ын өдөр + цаг → ISO (`+08:00`). */
export function ubDateTimeToIso(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(
    new TZDate(y, m - 1, d, hh, mm, 0, 0, UB_TIMEZONE).getTime(),
  ).toISOString();
}

/** ISO → УБ-ын `{ day: "yyyy-MM-dd", time: "HH:mm" }` (30 минут руу доош). */
export function isoToUbParts(iso: string): { day: string; time: string } {
  const d = new TZDate(new Date(iso).getTime(), UB_TIMEZONE);
  const minutes = d.getMinutes() < 30 ? "00" : "30";
  return {
    day: format(d, "yyyy-MM-dd"),
    time: `${format(d, "HH")}:${minutes}`,
  };
}

/** «10/20 14:00» — админы жагсаалтад, УБ-ын цагаар. */
export function formatUbDateTime(iso: string): string {
  return format(
    new TZDate(new Date(iso).getTime(), UB_TIMEZONE),
    "MM/dd HH:mm",
  );
}

export type BroadcastPhase =
  | "draft"
  | "scheduled"
  | "overdue"
  | "sent"
  | "cancelled";

export function broadcastPhase(
  b: Pick<BroadcastAdminRow, "status" | "overdue">,
): BroadcastPhase {
  if (b.status === "scheduled" && b.overdue) return "overdue";
  return b.status;
}

export const BROADCAST_PHASE_LABEL: Record<BroadcastPhase, string> = {
  draft: "Ноорог",
  scheduled: "Хуваарьт",
  overdue: "Хугацаа хэтэрсэн",
  sent: "Илгээсэн",
  cancelled: "Буцаасан",
};

/** Уншсан хувь, бүхэл тоо. Хүлээн авагчгүй бол 0. */
export function readPercent(read: number, recipients: number): number {
  if (recipients <= 0) return 0;
  return Math.round((Math.min(read, recipients) / recipients) * 100);
}
