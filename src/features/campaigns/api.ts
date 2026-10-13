import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignRow } from "@/db/types";

/** Кампанит ажил + тоолол — админы жагсаалтын нэг мөр. */
export interface CampaignAdminRow {
  id: string;
  type: CampaignRow["type"];
  name: string;
  description: string;
  isActive: boolean;
  startsOn: string;
  endsOn: string;
  couponValue: number;
  minSubtotal: number;
  couponValidDays: number;
  createdAt: string;
  stats: {
    /** Купон авсан хэрэглэгч. */
    customers: number;
    /** Үүссэн купон. */
    issued: number;
    /** Ашиглагдсан купон (эзэмшигч эсвэл кодыг нь авсан өөр хүн). */
    used: number;
  };
}

function toAdminRow(
  c: CampaignRow,
  stats: CampaignAdminRow["stats"],
): CampaignAdminRow {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    description: c.description,
    isActive: c.is_active,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    couponValue: c.coupon_value,
    minSubtotal: c.min_subtotal,
    couponValidDays: c.coupon_valid_days,
    createdAt: c.created_at,
    stats,
  };
}

/**
 * Админы «Кампанит ажил» хуудас. Session client — staff RLS (0135).
 *
 * Тоолол нь кампанит ажил бүрт `count: exact, head` — мөрүүдийг татахгүй тул
 * олон мянган бүртгэлтэй ч PostgREST-ийн 1000 мөрийн хязгаарт бүдрэхгүй.
 * Кампанит ажил цөөхөн (жилд хэдхэн) тул хүсэлтийн тоо асуудалгүй.
 */
export async function getCampaignsAdmin(): Promise<CampaignAdminRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("starts_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`campaigns: ${error.message}`);
  const rows = (data as CampaignRow[] | null) ?? [];

  return Promise.all(
    rows.map(async (c) => {
      const [grants, issued, used] = await Promise.all([
        supabase
          .from("campaign_grants")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id),
        supabase
          .from("coupons")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id),
        supabase
          .from("coupons")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .eq("used_up", true),
      ]);
      return toAdminRow(c, {
        customers: grants.count ?? 0,
        issued: issued.count ?? 0,
        used: used.count ?? 0,
      });
    }),
  );
}
