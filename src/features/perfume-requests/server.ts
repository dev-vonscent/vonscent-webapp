import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const notFound = () =>
  NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

/**
 * Хэрэглэгчийн route-ын хаалга: туг (404) → нэвтэрсэн (401) → service-role.
 * Хүснэгтүүд staff-only RLS-тэй (0137) тул бичилт RPC-ээр, service-role-оор.
 */
export async function perfumeRequestUserGate() {
  if (!(await isFeatureEnabled("perfume_requests"))) {
    return { response: notFound() } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    return {
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    } as const;
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { admin, user } as const;
}

/** Админы route-ын хаалга: туг (404) → staff (403) → service-role. */
export async function perfumeRequestAdminGate() {
  if (!(await isFeatureEnabled("perfume_requests"))) {
    return { response: notFound() } as const;
  }
  if (!isSupabaseConfigured) {
    return { response: NextResponse.json({ demo: true }) } as const;
  }
  const staff = await getStaffUser();
  if (!staff) {
    return {
      response: NextResponse.json(
        { error: "Эрх баталгаажсангүй. Хуудсаа сэргээгээд дахин нэвтэрнэ үү." },
        { status: 403 },
      ),
    } as const;
  }
  const supabase = createAdminClient();
  if (!supabase) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { supabase, staff } as const;
}
