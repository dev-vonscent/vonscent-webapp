"use client";

import * as React from "react";
import { useCart } from "./store";
import { cartMlFor } from "./budget";
import { maxUnits } from "@/features/products/sellable";
import { toast } from "@/lib/toast";
import type { ProductDetail } from "@/lib/types";
import type { LiveVariantPrice } from "./live-prices";

/**
 * Сагсан дахь мөрүүд ӨНӨӨДӨР зарагдах эсэх.
 *
 * Сагс нь `localStorage`-д (zustand persist) хадгалагддаг тул долоо хоногоор
 * сууж болно: тэр хугацаанд бараа хаагдах, үлдэгдэл дуусах, эсвэл савны
 * түгжээ (0095) орох боломжтой. Сервер тал нь checkout дээр аль хэдийн
 * шалгадаг ч хэрэглэгчид ТЭР ХҮРТЭЛ юу ч мэдэгдэхгүй байсан — энэ дэгээ нь
 * сагс нээгдэхэд нэг удаа асууж, асуудалтай мөрийг тэндээ тэмдэглэнэ.
 *
 * Хүслийн жагсаалттай ижил загвар (`/api/products?ids=…&details=1`).
 */

export interface LineStatus {
  sellable: boolean;
  reason: ProductDetail["variants"][number]["unavailableReason"];
}

const OK: LineStatus = { sellable: true, reason: null };
/** Хариунд огт ирээгүй мөр — бараа нуугдсан/устсан, эсвэл хэмжээ устсан. */
const GONE: LineStatus = { sellable: false, reason: "inactive" };

export function useCartAvailability({
  /**
   * Асуулгыг хойшлуулах — сагсны хуудас үргэлж идэвхтэй, харин drawer нь
   * зөвхөн НЭЭГДЭХЭД асуух ёстой: хаалттай байхад нь хуудас бүр дээр нэмэлт
   * хүсэлт явуулах шалтгаан байхгүй.
   */
  enabled = true,
  /**
   * «Захиалах» мөрийг шалгах — тэр мөр сагсанд ордоггүй тул сагсны бусад
   * мөртэй үлдэгдэл хуваалцахгүй, ганцаараа эх савнаас тооцогдоно (сервер ч
   * зөвхөн түүнийг reserve хийнэ). Төлбөрийн хуудасны тойм (`OrderLines`).
   */
  buyNow = false,
  /**
   * Сонгогдсон мөрийг захиалж болохгүй гэж сонголтоос гаргасан үед
   * (`Нэр 10ml` хэлбэрийн нэрсээр). Сагс/drawer мөр бүр дор шалтгаанаа
   * бичдэг тул хэрэггүй; харин төлбөрийн хуудас мөрийг тоймоос шууд
   * алга болгодог тул хэрэглэгчид юу, яагаад хасагдсаныг хэлэх ёстой.
   */
  onDeselect,
}: {
  enabled?: boolean;
  buyNow?: boolean;
  onDeselect?: (labels: string[]) => void;
} = {}) {
  const cartItems = useCart((s) => s.items);
  const cartCollections = useCart((s) => s.collections);
  const buyNowLine = useCart((s) => s.buyNow);
  const items = React.useMemo(
    () =>
      !buyNow
        ? cartItems
        : buyNowLine?.kind === "item"
          ? [buyNowLine.item]
          : [],
    [buyNow, buyNowLine, cartItems],
  );
  const collections = React.useMemo(
    () =>
      !buyNow
        ? cartCollections
        : buyNowLine?.kind === "collection"
          ? [buyNowLine.collection]
          : [],
    [buyNow, buyNowLine, cartCollections],
  );

  // Барааны id-ууд — өөрчлөгдөхөд л дахин асууна.
  const idKey = React.useMemo(() => {
    const ids = new Set<string>();
    for (const i of items) ids.add(i.productId);
    for (const c of collections)
      for (const m of c.members) ids.add(m.productId);
    return [...ids].sort().join(",");
  }, [items, collections]);

  const [byVariant, setByVariant] = React.useState<Map<
    string,
    LineStatus
  > | null>(null);
  /**
   * productId → эх савны үлдэгдэл ml. `sellable` нь НЭГ ширхэгийн асуулт тул
   * «хэдэн ширхэг» гэдгийг эндээс бодно: 15ml үлдэгдэлтэй бараанаас 10ml×2
   * авах гэж байгааг сагс өөрөө хэлэх ёстой, checkout хүлээх ёсгүй.
   */
  const [stock, setStock] = React.useState<Map<string, number> | null>(null);
  /** `byVariant` аль `idKey`-ийн хариу вэ — хуучин хариугаар шинэ мөрийг шүүхгүй. */
  const [checkedKey, setCheckedKey] = React.useState<string | null>(null);

  const applyPrices = useCart((s) => s.applyLivePrices);
  /** Үнэ өөрчлөгдсөнийг НЭГ мэдэгдлээр, нэг зүйлийг давтахгүй. */
  const announcedPrices = React.useRef("");
  const announcePrices = React.useCallback(
    (changed: string[]) => {
      if (changed.length === 0) return;
      const signature = changed.join("|");
      if (announcedPrices.current === signature) return;
      announcedPrices.current = signature;
      toast(
        `Үнэ өөрчлөгдсөн тул шинэчиллээ: ${changed.join(", ")}.`,
        buyNow ? "Захиалга шинэчлэгдлээ" : "Сагс шинэчлэгдлээ",
      );
    },
    [buyNow],
  );

  /**
   * Багцын үнэ — гишүүдийн үнэ, багцын хувь, тэгшлэлтээс хамаардаг тул
   * клиент дээр дахин бодохгүй: захиалгатай ЯГ ИЖИЛ замаар
   * (`/api/collections/quote` → `priceCollectionLines`) асууна. Багц тус
   * бүрт нэг хүсэлт, зөвхөн сагс нээгдэх / бүрэлдэхүүн өөрчлөгдөхөд.
   */
  const bundleKey = React.useMemo(
    () => collections.map((c) => c.key).join(","),
    [collections],
  );
  const collectionsRef = React.useRef(collections);
  React.useEffect(() => {
    collectionsRef.current = collections;
  });
  React.useEffect(() => {
    if (!bundleKey || !enabled) return;
    let cancelled = false;
    const cols = collectionsRef.current;
    Promise.all(
      cols.map(async (c) => {
        const res = await fetch("/api/collections/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectionId: c.collectionId,
            type: c.type,
            productIds: c.members.map((m) => m.productId),
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          sizes?: {
            ml: number;
            available: boolean;
            price: number;
            discountPct: number;
            members: { variantId: string; price: number }[];
            saleLabel?: string | null;
            saleAmount?: number;
          }[];
        };
        const size = data.sizes?.find((s) => s.ml === c.ml && s.available);
        return size ? ([c.key, size] as const) : null;
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const live = Object.fromEntries(
          rows.filter((r): r is NonNullable<typeof r> => r != null),
        );
        announcePrices(applyPrices({ collections: live }));
      })
      // Сүлжээ унасан бол хуучин үнэ үлдэнэ — сервер checkout дээр барина.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bundleKey, enabled, applyPrices, announcePrices]);

  React.useEffect(() => {
    if (!idKey || !enabled) {
      setByVariant(null);
      setStock(null);
      setCheckedKey(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?ids=${idKey}&details=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        const map = new Map<string, LineStatus>();
        const ml = new Map<string, number>();
        const prices: Record<string, LiveVariantPrice> = {};
        for (const p of data.items as ProductDetail[]) {
          ml.set(p.id, p.soldOut ? 0 : p.availableMl);
          for (const v of p.variants) {
            map.set(v.id, {
              sellable: v.sellable,
              reason: v.unavailableReason,
            });
            prices[v.id] = {
              price: v.price,
              basePrice: v.basePrice,
              saleLabel: v.saleLabel ?? null,
            };
          }
        }
        setByVariant(map);
        setStock(ml);
        setCheckedKey(idKey);
        // Сагсанд нэмсэн мөчийн үнэ хуучирсан байж болно (хямдрал дууссан) —
        // ижил хариунаас одоогийн үнээр шинэчилнэ, нэмэлт хүсэлтгүй.
        announcePrices(applyPrices({ variants: prices }));
      })
      // Сүлжээ унасан бол сагсыг хаахгүй — сервер тал нь checkout дээр
      // хамгаална.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idKey, enabled, applyPrices, announcePrices]);

  /**
   * Мэдээлэл ирээгүй (сүлжээ/сервер унасан, эсвэл одоогийн id-уудын хариу
   * хараахан ирээгүй) бол «зүгээр» гэж үзнэ: сагсыг буруу шалтгаанаар
   * түгжихээс сервер талын шалгалт руу оруулах нь дээр. Харин ЭНЭ id-уудын
   * төлөө амжилттай ирсэн хариунд мөр огт байхгүй бол бараа нуугдсан/устсан
   * — checkout-д `ITEMS_UNAVAILABLE` болох тул энд тэмдэглэнэ. Сервер нь
   * хэсэгчилсэн алдааг 500 болгодог (`strict`) тул «алга» нь үнэхээр алга.
   */
  const statusOf = React.useCallback(
    (variantId: string): LineStatus => {
      const s = byVariant?.get(variantId);
      if (s) return s;
      return byVariant && checkedKey === idKey ? GONE : OK;
    },
    [byVariant, checkedKey, idKey],
  );

  /** Багц нь гишүүдийнхээ хамгийн муу төлөвөөр тодорхойлогдоно. */
  const collectionStatus = React.useCallback(
    (key: string): LineStatus => {
      const c = collections.find((x) => x.key === key);
      if (!c) return OK;
      for (const m of c.members) {
        const s = statusOf(m.variantId);
        if (!s.sellable) return s;
      }
      return OK;
    },
    [collections, statusOf],
  );

  /**
   * Мөрийн тоо ширхэгийн ДЭЭД хязгаар — тухайн барааны үлдэгдлээс сагсны
   * БУСАД мөрийн хэрэглээг хассан. Үлдэгдэл мэдэгдэхгүй (сүлжээ унасан,
   * бараа хариунд ирээгүй) бол `Infinity`: сагсыг буруу түгжихээс сервер
   * талын шалгалт руу оруулах нь дээр.
   */
  const maxQtyOf = React.useCallback(
    (key: string): number => {
      const item = items.find((i) => i.key === key);
      if (!item) return Infinity;
      const availableMl = stock?.get(item.productId);
      if (availableMl == null) return Infinity;
      const usedMl = cartMlFor(item.productId, {
        items: items.filter((i) => i.key !== key),
        collections,
      });
      return maxUnits({
        ml: item.ml,
        sellable: statusOf(item.variantId).sellable,
        remainingMl: availableMl - usedMl,
      });
    },
    [items, collections, stock, statusOf],
  );

  /**
   * Багцын дээд тоо: гишүүн бүр багцын ml-ээр цутгагдана — хамгийн хатуу
   * гишүүн шийднэ (`collectionStatus`-ийн «хамгийн муу гишүүн» загвартай
   * ижил).
   */
  const maxCollectionQtyOf = React.useCallback(
    (key: string): number => {
      const col = collections.find((c) => c.key === key);
      if (!col || col.members.length === 0) return Infinity;
      const others = collections.filter((c) => c.key !== key);
      let cap = Infinity;
      for (const m of col.members) {
        const availableMl = stock?.get(m.productId);
        if (availableMl == null) continue;
        const usedMl = cartMlFor(m.productId, { items, collections: others });
        cap = Math.min(
          cap,
          maxUnits({
            ml: col.ml,
            sellable: statusOf(m.variantId).sellable,
            remainingMl: availableMl - usedMl,
          }),
        );
      }
      return cap;
    },
    [items, collections, stock, statusOf],
  );

  const blockedItemKeys = React.useMemo(
    () =>
      new Set(
        items.filter((i) => !statusOf(i.variantId).sellable).map((i) => i.key),
      ),
    [items, statusOf],
  );

  const blockedCollectionKeys = React.useMemo(
    () =>
      new Set(
        collections
          .filter((c) => !collectionStatus(c.key).sellable)
          .map((c) => c.key),
      ),
    [collections, collectionStatus],
  );

  // Захиалж болохгүй мөрийг сонголтоос ГАРГАНА. Зөвхөн нүдийг нь салгаад
  // орхивол дүн, «сонгосон мөр» тоолуур, checkout гурав нь хоорондоо зөрнө —
  // хэрэглэгч захиалах боломжгүй барааны мөнгийг нийлбэрт хараад эргэлзэнэ.
  //
  // Сонголтын төлөвөөс ч хамаарна: «хаагдсан мөр сонгогдохгүй» нь нэг удаагийн
  // цэвэрлэгээ биш, байнгын нөхцөл. Өмнө нь зөвхөн `blocked*` өөрчлөгдөхөд
  // ажилладаг байсан тул «Бүгдийг сонгох» эсвэл чагтаар дахин сонгосон
  // хаагдсан мөр сонголтод үлдэж, «Захиалах»-ыг идэвхжүүлдэг байв.
  const excludedItems = useCart((s) => s.excludedItems);
  const excludedCollections = useCart((s) => s.excludedCollections);
  const setItemSelected = useCart((s) => s.setItemSelected);
  const setCollectionSelected = useCart((s) => s.setCollectionSelected);
  const onDeselectRef = React.useRef(onDeselect);
  React.useEffect(() => {
    onDeselectRef.current = onDeselect;
  });
  React.useEffect(() => {
    // «Захиалах» мөр сагсны сонголтод хамаарахгүй — ижил variant-ийн сагсны
    // мөрийг андуурч чагтаас гаргана.
    if (buyNow) return;
    const dropped: string[] = [];
    for (const i of items) {
      if (!blockedItemKeys.has(i.key) || excludedItems.includes(i.key))
        continue;
      setItemSelected(i.key, false);
      dropped.push(`${i.name} ${i.ml}ml`);
    }
    for (const c of collections) {
      if (
        !blockedCollectionKeys.has(c.key) ||
        excludedCollections.includes(c.key)
      )
        continue;
      setCollectionSelected(c.key, false);
      dropped.push(`${c.name} ${c.ml}ml багц`);
    }
    if (dropped.length > 0) onDeselectRef.current?.(dropped);
  }, [
    buyNow,
    items,
    collections,
    blockedItemKeys,
    blockedCollectionKeys,
    excludedItems,
    excludedCollections,
    setItemSelected,
    setCollectionSelected,
  ]);

  /**
   * Сагс `localStorage`-д долоо хоногоор сууна: тэр хугацаанд үлдэгдэл
   * буурч, дотор нь хэвтэж байсан 2 ширхэг захиалагдахаа болино. Мөрийг
   * хасалгүй багтах тоонд нь буулгаад, сонголтоос нь хасахгүй — хэрэглэгч
   * сагсаа нээхэд шинэ тоог хараад шийднэ. Дор хаяж 1 ш ч багтахгүй бол
   * дээрх `blocked*` шалгалт мөрийг аль хэдийн сонголтоос гаргасан байна.
   *
   * Тоог ЧИМЭЭГҮЙ буулгахгүй: хэрэглэгч 2 ширхэг үлдээсэн сагсаа нээхэд
   * 1 болсныг ямар ч тайлбаргүй хармаар байдаг нь итгэл алдуулна. Бүх
   * буулгалтыг НЭГ мэдэгдэлд нэгтгэнэ.
   */
  const setQty = useCart((s) => s.setQty);
  const setCollectionQty = useCart((s) => s.setCollectionQty);
  const setBuyNowQty = useCart((s) => s.setBuyNowQty);
  /** Хамгийн сүүлд мэдэгдсэн буулгалтууд — нэг зүйлийг давтаж хэлэхгүй. */
  const announced = React.useRef("");
  React.useEffect(() => {
    if (!stock) return;
    const notes: string[] = [];
    for (const i of items) {
      const cap = maxQtyOf(i.key);
      if (cap >= 1 && i.qty > cap) {
        if (buyNow) setBuyNowQty(cap, cap);
        else setQty(i.key, cap, cap);
        notes.push(`${i.name} ${i.ml}ml → ${cap} ш`);
      }
    }
    for (const c of collections) {
      const cap = maxCollectionQtyOf(c.key);
      if (cap >= 1 && c.qty > cap) {
        if (buyNow) setBuyNowQty(cap, cap);
        else setCollectionQty(c.key, cap, cap);
        notes.push(`${c.name} ${c.ml}ml → ${cap} ш`);
      }
    }
    if (notes.length === 0) return;
    const signature = notes.join("|");
    if (announced.current === signature) return;
    announced.current = signature;
    toast(
      `Үлдэгдэл хүрэлцэхгүй тул тоо ширхэгийг багасгалаа: ${notes.join(", ")}.`,
      buyNow ? "Захиалга шинэчлэгдлээ" : "Сагс шинэчлэгдлээ",
    );
  }, [
    buyNow,
    stock,
    items,
    collections,
    maxQtyOf,
    maxCollectionQtyOf,
    setQty,
    setCollectionQty,
    setBuyNowQty,
  ]);

  return {
    statusOf,
    collectionStatus,
    maxQtyOf,
    maxCollectionQtyOf,
    blockedItemKeys,
    blockedCollectionKeys,
    hasBlocked: blockedItemKeys.size > 0 || blockedCollectionKeys.size > 0,
  };
}

/** Мөрний дор харагдах тайлбар. */
export function unavailableLabel(status: LineStatus): string {
  if (status.sellable) return "";
  return status.reason === "bottle"
    ? "Энэ хэмжээний сав түр дууссан байна — өөр хэмжээ сонгоно уу."
    : status.reason === "inactive"
      ? "Энэ хэмжээ зарагдахаа больсон байна."
      : "Энэ хэмжээ түр дууссан байна.";
}
