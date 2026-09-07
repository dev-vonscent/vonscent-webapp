import type { Metadata } from "next";
import { LuckyWheel } from "@/features/lucky-wheel/components/lucky-wheel";

/**
 * Азын хүрд (docs/lucky-wheel.md).
 *
 * Rendered on the client from `/api/lucky-wheel`: every value on this page —
 * the customer's balance, their cooldown, their history — is per-session, so
 * there is nothing here worth an ISR cache, and a server render would only
 * force the whole page dynamic for no gain.
 */
export const metadata: Metadata = {
  title: "Азын хүрд",
  description:
    "Өдөрт нэг удаа үнэгүй эргүүлээд V point, хөнгөлөлтийн купон эсвэл 2мл таних багц хожоорой.",
};

export default function LuckyWheelPage() {
  return <LuckyWheel />;
}
