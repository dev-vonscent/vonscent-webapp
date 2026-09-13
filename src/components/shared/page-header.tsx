import * as React from "react";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/shared/count-badge";

/**
 * Хуудасны толгой — гарчиг, (сонголтоор) тоолуур, тайлбар, баруун талын
 * үйлдлүүд.
 *
 * Админы 15 хуудас бүр өөрийн `<div className="flex flex-wrap items-center
 * justify-between gap-3"><h1 className="font-serif text-2xl font-semibold">`
 * гэсэн хуулбартай байсан бөгөөд заримд нь `justify-between` байхгүй,
 * заримд нь тоолуур өөр өөр хэлбэртэй байв. Нэг компонент болов.
 */
export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: string;
  /** Гарчгийн хажуугийн тоолуур (нийт мөрийн тоо г.м.). */
  count?: number;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          {count !== undefined && <CountBadge value={count} />}
        </div>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
