"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { SHIPPING_ZONES, type ShippingZoneConfig } from "@/lib/constants";

/**
 * Админы хүргэлтийн бүсүүд (`settings.shipping.zones`). Хаягийн dialog ба
 * хадгалсан хаягийн жагсаалтууд «унаагаар явах хаяг уу» (`isRemoteAddress`)
 * гэдгийг үүгээр шийднэ. Ачаалагдах хүртэл, эсвэл тохиргоо хоосон бол
 * `SHIPPING_ZONES` — сервер ч мөн адил fallback хийдэг.
 */
export function useShippingZones(): readonly ShippingZoneConfig[] {
  const { data } = useQuery({
    queryKey: ["settings", "shipping", "zones"],
    queryFn: async () => {
      const supabase = createClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "shipping")
        .maybeSingle();
      const zones = (
        data as { value?: { zones?: Partial<ShippingZoneConfig>[] } } | null
      )?.value?.zones;
      if (!Array.isArray(zones) || zones.length === 0) return null;
      return zones.map(
        (z): ShippingZoneConfig => ({
          code: z.code?.trim() || z.name || "",
          name: z.name ?? "",
          fee: Number(z.fee) || 0,
          deliverable: z.deliverable !== false,
          remote: z.remote === true,
          areas: Array.isArray(z.areas) ? z.areas : [],
        }),
      );
    },
    staleTime: 5 * 60_000,
  });
  return data ?? SHIPPING_ZONES;
}
