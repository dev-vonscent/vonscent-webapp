"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast as sonner, Toaster } from "sonner";
import type { ToastPlan } from "../lib";
import { useNotificationToasts } from "../use-notification-toasts";
import { useNotificationUserId } from "../use-notifications";
import { useOpenNotification } from "../use-open-notification";
import {
  NotificationSummaryToast,
  NotificationToast,
} from "./notification-toast";

const TOASTER_ID = "notifications";
const DURATION = 6_000;

/**
 * Шинэ мэдэгдлийн toast — баруун дээд (утсан дээр sonner өөрөө дээд төвд
 * бүтэн өргөнөөр). Сайтын ерөнхий `<Toaster />`-оос тусдаа (`toasterId`):
 * тэр нь top-center бөгөөд үйлдлийн хариуд зориулагдсан.
 */
export function NotificationCenter() {
  const userId = useNotificationUserId();
  if (!userId) return null;
  return <NotificationToaster />;
}

function NotificationToaster() {
  const router = useRouter();
  const open = useOpenNotification();

  const show = React.useCallback(
    (plan: ToastPlan) => {
      if (plan.type === "summary") {
        sonner.custom(
          (id) => (
            <NotificationSummaryToast
              count={plan.count}
              onOpen={() => {
                sonner.dismiss(id);
                router.push("/account/notifications");
              }}
              onClose={() => sonner.dismiss(id)}
            />
          ),
          { toasterId: TOASTER_ID, duration: DURATION },
        );
        return;
      }
      if (plan.type !== "single") return;
      for (const n of plan.items) {
        sonner.custom(
          (id) => (
            <NotificationToast
              notification={n}
              onOpen={() => {
                sonner.dismiss(id);
                open(n);
              }}
              onClose={() => sonner.dismiss(id)}
            />
          ),
          {
            id: `notification-${n.id}`,
            toasterId: TOASTER_ID,
            duration: DURATION,
          },
        );
      }
    },
    [open, router],
  );

  useNotificationToasts(show);

  return <Toaster id={TOASTER_ID} position="top-right" visibleToasts={3} />;
}
