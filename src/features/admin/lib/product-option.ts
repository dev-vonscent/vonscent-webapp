/**
 * Барааны «сонгогч»-ийн нэг мөр (0063 `admin_product_options`).
 *
 * Сервер ба браузар хоёулаа хэрэглэдэг тул `api.ts` (server-only)-оос тусад нь
 * байрлана. Энэ бол админы бүтэн барааны мөр БИШ — сонгогчид хэрэгтэй хэдэн
 * талбар л: өмнө нь эдгээр дэлгэц бүх каталогийг бүтнээр нь браузар руу
 * илгээдэг байсныг орлож байгаа зүйл.
 */
export interface ProductOption {
  id: string;
  name: string;
  brand: string;
  isActive: boolean;
  availableMl: number;
  /** ml → бодитоор төлөгдөх үнэ; зөвхөн идэвхтэй хэмжээ (0054). */
  priceByMl: Record<number, number>;
}

/** Нэг сонгогчид нэг удаад хэдэн мөр харуулах вэ. */
export const PRODUCT_OPTION_LIMIT = 30;
