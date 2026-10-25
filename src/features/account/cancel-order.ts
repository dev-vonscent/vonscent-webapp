/**
 * Захиалга цуцлах хүсэлт (`/api/orders/[id]/cancel`). Амжилтгүй бол
 * хэрэглэгчид харуулах монгол мессеж буцаана.
 */
export async function requestCancel(
  orderId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "POST",
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
    case "PAID_NOT_CANCELLABLE":
      return "Төлбөр төлөгдсөн захиалгыг цуцлах боломжгүй. Пэйж чат эсвэл утсаар холбогдоно уу.";
    default:
      return "Цуцлах үед алдаа гарлаа. Дахин оролдоно уу.";
  }
}
