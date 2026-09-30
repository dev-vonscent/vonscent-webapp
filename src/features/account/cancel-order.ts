import type { RefundAccountInput } from "@/lib/validators/refund";

/**
 * Захиалга цуцлах хүсэлт (`/api/orders/[id]/cancel`). Амжилтгүй бол
 * хэрэглэгчид харуулах монгол мессеж буцаана.
 */
export async function requestCancel(
  orderId: string,
  refundAccount?: RefundAccountInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      ...(refundAccount && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAccount }),
      }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: cancelErrorMessage(data.error) };
  } catch {
    return { ok: false, message: cancelErrorMessage() };
  }
}

function cancelErrorMessage(code?: string): string {
  switch (code) {
    case "PAST_CUTOFF":
      return "Хүргэх өдөр эхэлсэн тул захиалга цуцлах боломжгүй. Пэйж чат эсвэл утсаар холбогдоно уу.";
    case "REFUND_ACCOUNT_REQUIRED":
    case "VALIDATION":
      return "Буцаалтын дансаа бүрэн, зөв бөглөнө үү.";
    case "REFUND_ACCOUNT_FAILED":
      return "Дансыг хадгалж чадсангүй — захиалга цуцлагдаагүй. Дахин оролдоно уу.";
    default:
      return "Цуцлах үед алдаа гарлаа. Дахин оролдоно уу.";
  }
}
