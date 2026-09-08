import type { Metadata } from "next";
import { CouponDetail } from "@/features/account/components/coupon-detail";

/**
 * `/account/coupons/<code>` — one coupon in full.
 *
 * The coupon itself is read in the browser under RLS, which is what keeps a
 * personal code private: the policy narrows `coupons` to the public ones plus
 * the signed-in customer's own, so guessing someone else's code in the URL
 * returns nothing to render.
 */
export const metadata: Metadata = {
  title: "Купон",
  robots: { index: false, follow: false },
};

export default async function CouponPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CouponDetail code={decodeURIComponent(code)} />;
}
