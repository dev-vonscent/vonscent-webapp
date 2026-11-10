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
  // Тайлбар нь гарчиг + үйлдлийн мөрийн ДООР: өмнө нь тайлбар гарчигтай нэг
  // блокт байсан тул утсан дээр урт тайлбар өргөнийг бүхэлд нь эзэлж,
  // «Бараа нэмэх» г.м. товч тусдаа мөрөнд унадаг байв.
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          {count !== undefined && <CountBadge value={count} />}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {description && (
        <p className="text-muted-foreground max-w-prose text-sm text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}
