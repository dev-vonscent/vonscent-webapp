import {
  REVIEW_REJECT_REASON_LABEL,
  type ReviewRejectReason,
} from "@/lib/constants";

/**
 * Цуцалсан шалтгааны текст: «Бусад» дээр админы бичсэн тэмдэглэл (0167),
 * үгүй бол тогтмол шошго.
 */
export function rejectReasonText(
  reason: ReviewRejectReason,
  note: string | null | undefined,
): string {
  return reason === "other" && note?.trim()
    ? note.trim()
    : REVIEW_REJECT_REASON_LABEL[reason];
}
