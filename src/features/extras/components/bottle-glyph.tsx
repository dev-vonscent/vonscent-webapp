import { cn } from "@/lib/utils";

/**
 * Шилний дүрс — дотор нь хэр үнэртэн байгааг дүүргэлтээр (0 хоосон, 1
 * бүтэн). Гурван төрлийн шилийг үгнээс өмнө нүдээр ялгуулна. Hook-гүй тул
 * server component-д ч ажиллана.
 */
export function BottleGlyph({
  fill,
  className,
}: {
  fill: number;
  className?: string;
}) {
  const f = Math.min(Math.max(fill, 0), 1);
  // Биеийн дотор тал: y 10.5 – 29.5.
  const top = 10.5 + 19 * (1 - f);
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      aria-hidden
      className={cn("size-8", className)}
    >
      <rect
        x="9"
        y="1.5"
        width="6"
        height="3.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 5v3M14 5v3" stroke="currentColor" strokeWidth="1.5" />
      <rect
        x="4"
        y="8"
        width="16"
        height="22.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {f > 0 && (
        <rect
          x="6"
          y={top}
          width="12"
          height={29 - top}
          rx="1.75"
          className="fill-gold-strong"
          opacity="0.85"
        />
      )}
    </svg>
  );
}
