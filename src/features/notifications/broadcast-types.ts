import type { BroadcastKind } from "@/lib/validators/notification";

export type BroadcastStatus = "draft" | "scheduled" | "sent" | "cancelled";

/** Админы «Мэдэгдэл илгээх» жагсаалтын нэг мөр. */
export interface BroadcastAdminRow {
  id: string;
  kind: BroadcastKind;
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
  publishAt: string;
  status: BroadcastStatus;
  /** Хуваарьт боловч 24 цагаас хэтэрсэн — cron илгээхгүй (0138). */
  overdue: boolean;
  sentAt: string | null;
  recipientCount: number;
  readCount: number;
  cancelledAt: string | null;
  createdAt: string;
}

/** Холбоосын сонгогчийн сонголт. */
export interface BroadcastLinkTarget {
  type: "product" | "collection";
  label: string;
  url: string;
  imageUrl: string | null;
}

/** Шинэ маягтын анхны утга (ж: бараа засах хуудаснаас). */
export interface BroadcastPrefill {
  kind: BroadcastKind;
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
}
