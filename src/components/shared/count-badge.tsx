import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Тоолуурын badge.
 *
 * Тоо нь дэлгэц уншигчид ганцаараа утгагүй («12» гэж уншигдана) тул
 * `label`-ийг `sr-only` мөрөөр өгнө — өгөгдөөгүй бол «нийт» гэж уншина.
 * `tabular-nums` нь жагсаалт шинэчлэгдэхэд тоо үсрэхээс сэргийлнэ.
 */
export function CountBadge({
  value,
  label = "нийт",
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("tabular-nums", className)}>
      {value.toLocaleString("mn-MN")}
      <span className="sr-only"> {label}</span>
    </Badge>
  );
}
