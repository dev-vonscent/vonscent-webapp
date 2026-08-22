import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment status for the success page's poller: once QPay's callback marks the
 * order paid, the page flips to "Төлбөр амжилттай" and fires the purchase
 * analytics event. Exposes nothing but a boolean for a known order number.
 */
export async function GET(req: Request) {
  const orderNo = new URL(req.url).searchParams.get("order");
  if (!orderNo) {
    return NextResponse.json({ error: "MISSING_ORDER" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ paid: false, demo: true });

  const { data } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("order_no", orderNo)
    .maybeSingle();
  const paid =
    (data as { payment_status: string } | null)?.payment_status === "paid";
  return NextResponse.json({ paid });
}
