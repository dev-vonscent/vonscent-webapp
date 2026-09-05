"use client";

import * as React from "react";
import { GIFT_SAMPLE_ML, GIFT_THRESHOLD } from "@/lib/constants";

export interface GiftPoolProduct {
  id: string;
  name: string;
  brand: string;
  image: string | null;
}

export interface GiftPool {
  /** Сан идэвхтэй бөгөөд дор хаяж нэг ус нь бэлгэнд бэлэн. */
  enabled: boolean;
  threshold: number;
  sampleMl: number;
  products: GiftPoolProduct[];
}

const EMPTY: GiftPool = {
  enabled: false,
  threshold: GIFT_THRESHOLD,
  sampleMl: GIFT_SAMPLE_ML,
  products: [],
};

/**
 * Бэлгийн сан — сагс, checkout хоёулаа энэ нэг эх сурвалжаас уншина
 * (backlog A2). Хуудас хооронд дахин татахгүйн тулд module-д кэшлэнэ.
 */
let inFlight: Promise<GiftPool> | null = null;

function loadPool(): Promise<GiftPool> {
  inFlight ??= fetch("/api/gifts")
    .then((r) => r.json())
    .then((d): GiftPool => {
      const products: GiftPoolProduct[] = Array.isArray(d?.products)
        ? d.products
        : [];
      return {
        enabled: Boolean(d?.enabled) && products.length > 0,
        threshold: Number(d?.threshold) || GIFT_THRESHOLD,
        sampleMl: Number(d?.sampleMl) || GIFT_SAMPLE_ML,
        products,
      };
    })
    .catch(() => EMPTY);
  return inFlight;
}

/** null = хараахан ачаалж амжаагүй (юу ч харуулахгүй). */
export function useGiftPool(): GiftPool | null {
  const [pool, setPool] = React.useState<GiftPool | null>(null);
  React.useEffect(() => {
    let alive = true;
    loadPool().then((p) => {
      if (alive) setPool(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return pool;
}
