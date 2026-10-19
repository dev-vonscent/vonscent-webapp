"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";

export interface RestockLine {
  id: string;
  title: string;
  qty: number;
  /** Өмнө нөөцөд буцаасан (эцсийн нийт). */
  restocked: number;
}

/**
 * «Нөөцөд буцаах бараа» (extras-shop-plan §7.4) — хүргэгдсэний дараах
 * буцаалтад энгийн нэмэлт барааны мөр бүрт хэдэн ширхэг нөөцөд буцсаныг
 * бичнэ. Мөнгөний дүнд нөлөөлөхгүй; сав, үлдэгдэлтэй шилний мөр энд
 * гарахгүй. Тоо нь эцсийн нийт — ижил тоог давтан хадгалахад нөөц дахин
 * нэмэгдэхгүй, бууруулах боломжгүй.
 */
export function ExtraRestockPanel({
  orderId,
  lines,
}: {
  orderId: string;
  lines: RestockLine[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, String(l.restocked)])),
  );
  const [busy, setBusy] = React.useState(false);

  const parsed = lines.map((l) => {
    const n = Number(values[l.id]);
    return {
      line: l,
      n,
      valid: Number.isInteger(n) && n >= l.restocked && n <= l.qty,
    };
  });
  const changed = parsed.filter((p) => p.valid && p.n !== p.line.restocked);
  const invalid = parsed.some((p) => !p.valid);

  async function save() {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/orders/${orderId}/status`,
      "POST",
      {
        extraRestocks: changed.map((p) => ({
          orderItemId: p.line.id,
          restockedQty: p.n,
        })),
      },
      "Нөөцөд буцаасангүй",
    );
    setBusy(false);
    if (ok) {
      toast.success("Нөөцөд буцаалаа");
      router.refresh();
    }
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Нөөцөд буцаах бараа</h3>
        <p className="text-muted-foreground text-xs">
          Буцаж ирсэн, дахин зарж болох ширхгийг бичнэ. Мөнгөний дүнд
          нөлөөлөхгүй.
        </p>
      </div>
      <ul className="space-y-2">
        {parsed.map(({ line, valid }) => (
          <li key={line.id} className="flex items-center gap-3">
            <label
              htmlFor={`restock-${line.id}`}
              className="min-w-0 flex-1 text-sm"
            >
              <span className="line-clamp-2">{line.title}</span>
              <span className="text-muted-foreground block text-xs">
                {line.qty} ширхэгээс
                {line.restocked > 0 && ` · өмнө ${line.restocked} буцаасан`}
              </span>
            </label>
            <Input
              id={`restock-${line.id}`}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!valid}
              value={values[line.id]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [line.id]: e.target.value }))
              }
              className="w-20 text-right tabular-nums"
            />
          </li>
        ))}
      </ul>
      <LoadingButton
        type="button"
        variant="secondary"
        className="h-11 w-full md:h-10"
        loading={busy}
        disabled={invalid || changed.length === 0}
        onClick={save}
      >
        Нөөцөд буцаах
      </LoadingButton>
    </section>
  );
}
