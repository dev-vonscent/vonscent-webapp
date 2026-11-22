import { cn } from "@/lib/utils";

export type StockMode = "purchase" | "adjust";

const LABEL: Record<StockMode, string> = {
  purchase: "Нөөц нөхөх",
  adjust: "Тоо засах",
};

/**
 * Нөөцийн цонхны хоёр үйлдэл (plan §18.4): худалдан авалт нь үндсэн —
 * өртөг тайланд орно; тоо засах нь тооллогын залруулга, өртөггүй.
 */
export function StockModeToggle({
  value,
  onChange,
}: {
  value: StockMode;
  onChange: (mode: StockMode) => void;
}) {
  return (
    <div className="bg-secondary grid grid-cols-2 gap-1 rounded-lg p-1">
      {(Object.keys(LABEL) as StockMode[]).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "min-h-11 rounded-md text-sm font-medium transition-colors",
            value === m
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
