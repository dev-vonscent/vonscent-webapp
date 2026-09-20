import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Захиалгын идемпотентын түлхүүр (`order_requests`, 0087).
 *
 * `qpay_invoices`-ийн эзэмшлийн загвартай яг ижил: үнэтэй, буцаагдахгүй ажил
 * (нөөц түгжих, захиалга үүсгэх, QPay invoice) хийхээс ӨМНӨ мөрөө атомароор
 * эзэмшинэ. Хожигдсон тал давтахгүй, ялагчийн үр дүнг хүлээнэ.
 *
 * Эзэмшихээс дараа нь хийх нь хангалтгүй: хоёр зэрэгцээ хүсэлт хоёулаа
 * «түлхүүр байхгүй» гэж уншаад хоёулаа захиалга үүсгэчихнэ.
 */

/** Ялагч захиалгаа үүсгэх хүртэл хожигдсон талын хүлээх алхам. */
const WAIT_STEP_MS = 250;
const WAIT_STEPS = 24; // ≈6 секунд — place_order + QPay invoice-д хүрэлцэнэ.
/** Дуусаагүй эзэмшлийг хэдий хугацааны дараа хаягдсан гэж үзэх вэ. */
const STALE_CLAIM_MS = 30_000;

export interface ClaimResult {
  /** `true` бол энэ хүсэлт захиалга үүсгэх эрхтэй. */
  won: boolean;
  /** Хожигдсон үед: ялагчийн үүсгэсэн захиалгын id (олдоогүй бол `null`). */
  existingOrderId: string | null;
}

export async function claimOrderRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<ClaimResult> {
  const { data } = await supabase
    .from("order_requests")
    .upsert(
      { request_id: requestId },
      { onConflict: "request_id", ignoreDuplicates: true },
    )
    .select("request_id");
  if ((data as unknown[] | null)?.length) {
    return { won: true, existingOrderId: null };
  }

  // Эзэмшил аль хэдийн байна. Ялагч дуусчихсан бол захиалгыг нь шууд буцаана.
  for (let i = 0; i < WAIT_STEPS; i += 1) {
    const { data: row } = await supabase
      .from("order_requests")
      .select("order_id, created_at")
      .eq("request_id", requestId)
      .maybeSingle();
    const claim = row as {
      order_id: string | null;
      created_at: string;
    } | null;
    if (claim?.order_id) return { won: false, existingOrderId: claim.order_id };

    // Ялагч унасан (`place_order` алдаа, функц тасарсан) бол мөр мөнхөд
    // дуусаагүй үлдэнэ. Тийм эзэмшлийг булаана — эс тэгвээс хэрэглэгч ижил
    // түлхүүрээр хэзээ ч захиалга өгч чадахгүй болно.
    if (
      claim &&
      Date.now() - new Date(claim.created_at).getTime() > STALE_CLAIM_MS
    ) {
      const { data: stolen } = await supabase
        .from("order_requests")
        .update({ created_at: new Date().toISOString() })
        .eq("request_id", requestId)
        .is("order_id", null)
        .select("request_id");
      if ((stolen as unknown[] | null)?.length) {
        return { won: true, existingOrderId: null };
      }
    }
    await new Promise((r) => setTimeout(r, WAIT_STEP_MS));
  }

  // Ялагч амжсангүй. Давхар захиалга үүсгэхээс татгалзах нь дээр — клиент
  // «Захиалга хайх» хэсгээс шалгаж чадна.
  return { won: false, existingOrderId: null };
}

/** Эзэмшлийг захиалгад холбоно — хожигдсон тал үүнийг хүлээж байна. */
export async function completeOrderRequest(
  supabase: SupabaseClient,
  requestId: string,
  orderId: string,
): Promise<void> {
  await supabase
    .from("order_requests")
    .update({ order_id: orderId })
    .eq("request_id", requestId);
}

/** Захиалга үүсээгүй бол эзэмшлийг суллана — дахин оролдох боломжтой байх. */
export async function releaseOrderRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<void> {
  await supabase
    .from("order_requests")
    .delete()
    .eq("request_id", requestId)
    .is("order_id", null);
}
