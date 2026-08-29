import { getCoupons, getCustomerOptions } from "@/features/admin/api";
import { CouponManager } from "@/features/admin/components/coupon-manager";

export default async function AdminPromotionsPage() {
  // Customers come along so a coupon can be issued to one of them by name
  // (todo.md B4) and so the table can show who owns each personal code.
  const [coupons, customers] = await Promise.all([
    getCoupons(),
    getCustomerOptions(),
  ]);
  return (
    <CouponManager
      initial={coupons}
      customers={customers.map((c) => ({
        id: c.id,
        full_name: c.full_name ?? "",
        phone: c.phone,
      }))}
    />
  );
}
