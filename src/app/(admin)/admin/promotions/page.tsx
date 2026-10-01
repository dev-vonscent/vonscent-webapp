import { getCoupons, getCustomerOptions } from "@/features/admin/api";
import { CouponManager } from "@/features/admin/components/coupon-manager";

export default async function AdminPromotionsPage() {
  // Хувийн купоны эзэн хайлтаар сонгогдоно (todo.md B4) — энд зөвхөн
  // сонгогчийн эхний хуудас, хүснэгтэд байгаа эздийн нэр л ирнэ.
  const [coupons, customerOptions] = await Promise.all([
    getCoupons(),
    getCustomerOptions(),
  ]);
  const ownerIds = coupons.flatMap((c) => (c.user_id ? [c.user_id] : []));
  const owners = await getCustomerOptions({ ids: ownerIds });
  return (
    <CouponManager
      initial={coupons}
      owners={owners}
      customerOptions={customerOptions}
    />
  );
}
