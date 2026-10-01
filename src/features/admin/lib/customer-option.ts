/**
 * Хэрэглэгчийн «сонгогч»-ийн нэг мөр — хувийн купоны эзэн сонгоход.
 *
 * Сервер ба браузар хоёулаа хэрэглэдэг тул `api.ts` (server-only)-оос тусад нь
 * байрлана. Өмнө нь купоны хуудас бүх `profiles`-ыг props-оор татдаг байсан:
 * хайх боломжгүй, 1000-аас хойшх хэрэглэгч чимээгүй тасардаг байв.
 */
export interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
}

/** Нэг хайлтад хэдэн мөр харуулах вэ. */
export const CUSTOMER_OPTION_LIMIT = 20;

/** Сонгогч болон хүснэгтэд харагдах нэр — нэргүй бол утас. */
export function customerLabel(c: CustomerOption): string {
  return c.full_name || c.phone || "Нэргүй";
}
