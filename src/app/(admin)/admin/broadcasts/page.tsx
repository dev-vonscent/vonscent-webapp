import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBroadcastProductPrefill,
  getBroadcastsAdmin,
} from "@/features/notifications/broadcast-server";
import { BroadcastAdmin } from "@/features/notifications/components/broadcast-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Мэдэгдэл илгээх" };

/**
 * Админ → Маркетинг → Мэдэгдэл илгээх (0138). `/admin/notifications` нь
 * staff-ийн дотоод мэдэгдэл (0032) тул энэ нь тусдаа зам.
 *
 * Service-role: уншсан тоо нь `user_notifications`-аас (own-only RLS). Эрхийг
 * `(admin)` layout + middleware шалгадаг; бичих route бүр өөрөө дахин шалгана.
 */
export default async function AdminBroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  if (!(await isFeatureEnabled("notifications"))) notFound();
  const supabase = createAdminClient();
  if (!supabase)
    return <BroadcastAdmin rows={[]} audience={0} prefill={null} />;

  const { product } = await searchParams;
  const [{ rows, audience }, prefill] = await Promise.all([
    getBroadcastsAdmin(supabase),
    product
      ? getBroadcastProductPrefill(supabase, product.slice(0, 200))
      : null,
  ]);
  return <BroadcastAdmin rows={rows} audience={audience} prefill={prefill} />;
}
