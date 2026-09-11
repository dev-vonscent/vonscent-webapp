"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { useCart } from "@/features/cart/store";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

const DEMO_MESSAGE = "Демо режимд купон ажиллахгүй.";
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
 */
export function useCoupon(
  subtotal: number,
  { enabled = true }: { enabled?: boolean } = {},
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
    },
    [setCoupon],
  );

  const clear = React.useCallback(() => {
    setCoupon(null);
    setMessage(null);
    // Санал болгох купонуудыг дахин асуух эффект дараагийн render-т л
    // ажиллана — тэр хооронд «хоосон» гэж харагдахгүй байх нь энд шийдэгдэнэ.
    if (isSupabaseConfigured) setOffersLoading(true);
  }, [setCoupon]);

  // Боломжтой купонууд — зөвхөн купон хэрэглээгүй үед, дүн хөдлөх тутам
  // дахин асууна (доод дүн дөнгөж хүрсэн байж мэднэ).
  React.useEffect(() => {
    if (!enabled || appliedCode || subtotal <= 0 || !isSupabaseConfigured) {
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
        if (!cancelled) setOffersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, appliedCode, subtotal]);

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
    code,
    setCode,
    apply,
    applying,
    message,
    pick,
    clear,
  };
}
