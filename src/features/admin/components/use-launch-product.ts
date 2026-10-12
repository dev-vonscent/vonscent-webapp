"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";

/**
 * «Тун удахгүй» барааг худалдаанд гаргах (0125) — засах хуудасны
 * анхааруулга, нөөц нэмсний дараах асуулт, жагсаалтын мөрийн үйлдэл гурвын
 * нэг зам. Сервер нь нөхцөлтэй UPDATE хийдэг тул хуучирсан дэлгэцээс давхар
 * дарсан ч аюулгүй.
 *
 * Амжилттай бол `true` — дуудагч цонхоо хаах зэргийг шийднэ.
 */
export function useLaunchProduct() {
  const router = useRouter();
  const [launching, setLaunching] = React.useState(false);

  const launch = React.useCallback(
    async (productId: string, name: string): Promise<boolean> => {
      setLaunching(true);
      try {
        const ok = await mutateJson(
          `/api/admin/products/${productId}/launch`,
          "POST",
          {},
          "Худалдаанд гарсангүй",
        );
        if (!ok) return false;
        toast.success(
          `«${name}» худалдаанд гарлаа. «Шинэ» хэсэгт автоматаар орно.`,
        );
        router.refresh();
        return true;
      } finally {
        setLaunching(false);
      }
    },
    [router],
  );

  return { launch, launching };
}
