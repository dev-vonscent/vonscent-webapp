import type { Metadata } from "next";
import { CouponWallet } from "@/features/account/components/coupon-wallet";

/**
 * `/account/coupons` — «Миний купон» (0104). Moved off the account page so the
 * wallet has room for its three tabs; the mobile drawer already linked here.
 */
export const metadata: Metadata = {
  title: "Миний купон",
  robots: { index: false, follow: false },
};

export default function CouponsPage() {
  return <CouponWallet />;
}
