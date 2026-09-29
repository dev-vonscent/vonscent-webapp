"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { useCart } from "@/features/cart/store";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

const DEMO_MESSAGE = "Демо режимд купон ажиллахгүй.";
/**
 * Хэрэглэгч автоматаар тавьсан купоныг хассан эсэх — энэ таб дотор.
 *
 * Купон нь сагсны store-т persist хийгддэг тул хуудсыг дахин ачаалахад hook
 * шинээр эхэлж, хасуулсан купоноо дахин «өөрөө» тавьчихна. Хэрэглэгчийн
 * «хэрэггүй» гэсэн шийдвэрийг сесс дотор нь хадгална.
 */
const DISMISS_KEY = "vonscent-coupon-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(on: boolean) {
  try {
    if (on) sessionStorage.setItem(DISMISS_KEY, "1");
    else sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // Private mode — шийдвэр зөвхөн энэ mount-д үлдэнэ.
  }
}

/**
 * Энэ сагсан дээр хамгийн их хэмнэдэг, ашиглаж болох купон. Тэнцвэл эхнийх —
 * сервер дуусах огноо ойрыг нь түрүүлж өгдөг тул эхлээд дуусах нь сонгогдоно.
 */
export function bestOffer(offers: AvailableCoupon[]): AvailableCoupon | null {
  let best: AvailableCoupon | null = null;
  for (const o of offers) {
    if (!o.eligible || o.discount <= 0) continue;
    if (!best || o.discount > best.discount) best = o;
  }
  return best;
}
const NETWORK_MESSAGE = "Алдаа гарлаа. Дахин оролдоно уу.";

/**
 * Купоны нэгдсэн логик — сагс, checkout хоёр адилхан хэрэглэнэ.
 *
 * Гол зүйл нь **дахин шалгах** хэсэг: сагсанд хадгалагдсан хөнгөлөлт нь
 * хэрэглэсэн мөчийн дүн дээр тооцогдсон зураг л байсан. Сагсанд бараа
 * нэмэх/хасах, мөр чагтнаас гаргах бүрд хувь хэмжээний купоны дүн хуучирч,
 * доод дүнд хүрэхээ болих ч тохиолдол гардаг — «Нийт төлөх» нь серверийн
 * бодох дүнгээс зөрдөг байсан. Тиймээс дүн хөдлөх тутам сервертэй дахин
 * шалгаж, хүчингүй болбол купоныг өөрөө хаяад шалтгааныг хэлнэ.
 *
 * Захиалга үүсэхэд хөнгөлөлтийг `place_order` дахин бодох тул энэ бүхэн
 * зөвхөн хэрэглэгчид харагдах дүнг л зөв байлгах зорилготой.
 *
 * `autoPickBest` — checkout дээр купоны сонголт хийгээгүй бол хамгийн их
 * хэмнэдэгийг нь өөрөө тавина (2026-09-29 шийдвэр). Санал ирсэн анхны удаад
 * л нэг удаа: сагснаас аль хэдийн купон авч ирсэн бол түүнийг хүндэтгэнэ,
 * хэрэглэгч хассан бол дахин тавихгүй.
 */
export function useCoupon(
  subtotal: number,
  {
    enabled = true,
    autoPickBest = false,
  }: { enabled?: boolean; autoPickBest?: boolean } = {},
) {
  const coupon = useCart((s) => s.coupon);
  const setCoupon = useCart((s) => s.setCoupon);
  const [code, setCode] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [offers, setOffers] = React.useState<AvailableCoupon[]>([]);
  /**
   * Санал болгох купонуудыг сервер хайж байгаа эсэх.
   *
   * Ингэхгүй бол купоныг × дарж хасахад «Купон код» input нэг хормын турш
   * гялсхийгээд, санал ирэхэд нь дарагдаж алга болдог — хоосон жагсаалт нь
   * «купон байхгүй» гэсэн үг биш, «хараахан ирээгүй» гэсэн үг.
   */
  const [offersLoading, setOffersLoading] = React.useState(false);
  /** Санал нэг ч удаа ирсэн эсэх — автомат сонголт үүнийг хүлээнэ. */
  const [offersReady, setOffersReady] = React.useState(false);
  /** Автоматаар тавьсан купоны код — «хамгийн их хэмнэлттэйг сонгов» гэж хэлнэ. */
  const [autoCode, setAutoCode] = React.useState<string | null>(null);
  const autoTried = React.useRef(false);

  const appliedCode = coupon?.code ?? null;

  /** Гараар бичсэн кодыг шалгаад хэрэглэнэ. */
  const apply = React.useCallback(
    async (raw?: string) => {
      const value = (raw ?? code).trim();
      if (!value) return;
      if (!isSupabaseConfigured) {
        setMessage(DEMO_MESSAGE);
        return;
      }
      setApplying(true);
      setMessage(null);
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value, subtotal }),
        });
        const data = await res.json();
        if (data.valid) {
          setCoupon({
            code: data.code ?? value.toUpperCase(),
            discount: data.discount,
          });
          setCode("");
          writeDismissed(false);
        } else {
          setCoupon(null);
          setMessage(data.message ?? "Купон хүчингүй байна.");
        }
      } catch {
        setMessage(NETWORK_MESSAGE);
      } finally {
        setApplying(false);
      }
    },
    [code, subtotal, setCoupon],
  );

  /** Санал болгосон купоныг сонгох — дүн нь серверээс шалгагдсан. */
  const pick = React.useCallback(
    (offer: AvailableCoupon) => {
      setCoupon({ code: offer.code, discount: offer.discount });
      setMessage(null);
      writeDismissed(false);
    },
    [setCoupon],
  );

  const clear = React.useCallback(() => {
    setCoupon(null);
    setMessage(null);
    writeDismissed(true);
  }, [setCoupon]);

  // Боломжтой купонууд — дүн хөдлөх тутам дахин асууна (доод дүн дөнгөж
  // хүрсэн байж мэднэ). Купон хэрэглэсэн үед ч асууна: «Солих» нь бусдыг нь
  // харуулах ёстой.
  React.useEffect(() => {
    if (!enabled || subtotal <= 0 || !isSupabaseConfigured) {
      setOffers([]);
      setOffersLoading(false);
      return;
    }
    let cancelled = false;
    setOffersLoading(true);
    fetch("/api/coupons/available", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtotal }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setOffers(data?.coupons ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        setOffersLoading(false);
        setOffersReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, subtotal]);

  // Хамгийн их хэмнэлттэйг нэг удаа өөрөө тавина.
  React.useEffect(() => {
    if (!autoPickBest || !enabled || !offersReady || autoTried.current) return;
    autoTried.current = true;
    if (useCart.getState().coupon || readDismissed()) return;
    const best = bestOffer(offers);
    if (!best) return;
    setCoupon({ code: best.code, discount: best.discount });
    setAutoCode(best.code);
  }, [autoPickBest, enabled, offersReady, offers, setCoupon]);

  // Хэрэглэсэн купоныг дүн өөрчлөгдөх тутам дахин шалгана: хөнгөлөлт хуучирсан
  // бол шинэчилж, хүчингүй болсон бол хаяна.
  React.useEffect(() => {
    if (!enabled || !appliedCode || subtotal <= 0 || !isSupabaseConfigured) {
      return;
    }
    let cancelled = false;
    fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: appliedCode, subtotal }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const current = useCart.getState().coupon;
        // Хооронд өөр купон тавьсан байвал хуучин хариуг хэрэглэхгүй.
        if (current?.code !== appliedCode) return;
        if (data.valid) {
          if (data.discount !== current.discount) {
            setCoupon({ code: current.code, discount: data.discount });
          }
          setMessage(null);
        } else {
          setCoupon(null);
          setMessage(
            data.message ?? "Купон энэ захиалгад хэрэглэх боломжгүй болсон.",
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, appliedCode, subtotal, setCoupon]);

  /** Хөнгөлөлт нь дэд дүнгээс хэтрэхгүй (сервер ч мөн адил). */
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;

  return {
    coupon,
    discount,
    offers,
    offersLoading,
    /** Одоогийн купоныг хэрэглэгч биш, hook өөрөө сонгосон эсэх. */
    autoApplied: autoCode !== null && autoCode === appliedCode,
    code,
    setCode,
    apply,
    applying,
    message,
    pick,
    clear,
  };
}
