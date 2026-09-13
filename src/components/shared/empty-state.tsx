import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Хоосон төлөв — нэг компонент, нэг хэлбэр.
 *
 * Энэ нь өмнө нь арав орчим хуудсанд гараар давтагдаж байсан (каталог,
 * багц, хүслийн жагсаалт, дансны захиалга/оноо, админы хэрэглэгч/захиалга…).
 * Давтагдсан нь зөвхөн код биш — ХЭЛБЭР нь ч давхцахаа больсон байв: дүрс нь
 * заримдаа нүцгэн `size-10`, заримдаа `size-16` дугуйнд; хүрээ нь заримдаа
 * тасархай, заримдаа `bg-card`; босоо зай нь `py-12` … `py-24` дөрвөн өөр
 * утгатай. Хэрэглэгч нэг сайт дотор гурван өөр «хоосон» харж байлаа.
 *
 * Одоо хэлбэр нь энд нэг л удаа шийдэгдэнэ; дуудагч нь ЮУ гэж бичихээ л
 * шийднэ. `surface` нь дэвсгэрээс шалтгаална:
 *   • `dashed` — дэлгүүрийн хуудсууд (хуудас өөрөө дэвсгэргүй);
 *   • `card`   — админ (дэвсгэр нь `bg-muted/30` тул карт болж тодрох ёстой);
 *   • `muted`  — картан доторх хэсэг (данс), тэнд дахин карт зохимжгүй.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  surface = "dashed",
  size = "md",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  /** Ихэвчлэн `<Button asChild><Link…>`. */
  action?: React.ReactNode;
  surface?: "dashed" | "card" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 text-center",
        {
          dashed: "border-border rounded-2xl border border-dashed",
          card: "bg-card rounded-2xl",
          muted: "bg-secondary rounded-2xl",
        }[surface],
        { sm: "py-12", md: "py-16", lg: "py-24" }[size],
        className,
      )}
    >
      {Icon && (
        <span className="bg-secondary flex size-14 items-center justify-center rounded-full">
          {/* `aria-hidden` нь дүрсэнд: гарчиг нь аль хэдийн текстээр байгаа
              тул дэлгэц уншигчид давхардал болно. */}
          <Icon className="text-muted-foreground size-6" aria-hidden />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
