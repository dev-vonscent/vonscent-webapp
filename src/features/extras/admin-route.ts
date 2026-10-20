import "server-only";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSearchText } from "@/lib/search";
import { extraSlug, type ExtraSaveInput } from "@/lib/validators/extras";
import { extrasErrorMessage } from "./messages";

/**
 * `/api/admin/extras/*`-ийн нийтлэг хаалга: туг → эрх → service client.
 * Туг хаалттай бол 404 (plan §14 — админы хуудас ч тугаар хаагдана).
 */
export async function extrasAdminGate() {
  if (!(await isFeatureEnabled("extras_shop"))) {
    return {
      error: NextResponse.json({ error: "Олдсонгүй." }, { status: 404 }),
    } as const;
  }
  // Middleware-ээс гадна route handler дотор давхар шалгалт (development.md §7.5).
  const staff = await getStaffUser();
  if (!staff) {
    return {
      error: NextResponse.json({ error: "Эрх хүрэхгүй." }, { status: 403 }),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ demo: true }),
    } as const;
  }
  return { staff, supabase } as const;
}

/** RPC-ийн алдааг монгол мессежтэй 4xx/5xx хариу болгоно. */
export function extrasRpcError(message: string | undefined, fallback: string) {
  const known = extrasErrorMessage(message);
  if (!known) {
    Sentry.captureException(new Error(`extras rpc: ${message ?? "unknown"}`));
  }
  return NextResponse.json(
    { error: known ?? fallback },
    { status: known ? 409 : 500 },
  );
}

/** Zod-оор шалгасан маягтыг `extras_save`-ийн payload болгоно. */
export function savePayload(
  input: ExtraSaveInput,
  extra: { id?: string; categoryId?: string },
) {
  const common = {
    id: extra.id ?? null,
    category_id: extra.categoryId ?? null,
    slug: extraSlug(input.name, normalizeSearchText),
    name: input.name,
    description: input.description,
    images: input.images,
    sort: input.sort,
    // «Шилтэй ус» хоёр горимтой — SQL ангиллын зөвшөөрсөн горимтой тулгана.
    inventory_mode: input.mode,
  };
  switch (input.mode) {
    case "local_quantity":
      return {
        ...common,
        attrs: input.bottleMl ? { bottle_ml: input.bottleMl } : {},
        variants: input.variants.map((v) => ({
          id: v.id ?? null,
          label: v.label,
          price: v.price,
          is_active: v.isActive,
          sort: v.sort,
          // Ирээгүй (undefined) талбарыг SQL хөндөхгүй — JSON-д орохгүй.
          batch_code: v.batchCode,
          image_url: v.imageUrl,
          size_note: v.sizeNote,
        })),
      };
    case "shared_vial":
      return {
        ...common,
        attrs: {},
        variants: input.variants.map((v) => ({
          id: v.id ?? null,
          vial_id: v.vialId,
          price: v.price,
          is_active: v.isActive,
          sort: v.sort,
        })),
      };
    case "leftover_liquid":
      return {
        ...common,
        attrs: {},
        leftover: {
          product_id: input.productId,
          remaining_ml: input.remainingMl,
          full_ml: input.fullMl,
        },
        variants: [
          {
            id: input.variantId ?? null,
            price: input.price,
            is_active: true,
            sort: 0,
          },
        ],
      };
  }
}
