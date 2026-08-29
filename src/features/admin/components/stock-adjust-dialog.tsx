"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { mutateJson } from "@/features/admin/lib/mutate";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StockMode = "restock" | "correction";

/**
 * Why ml left the bottle without a sale. Free text was the alternative, but the
 * profit report groups these, and «гоожсон» / «алдагдсан» / «гээгдсэн» typed on
 * three different days are three different rows in that report.
 */
const CORRECTION_REASONS: { value: string; label: string }[] = [
  { value: "sold-elsewhere", label: "Өөр суваг дээр зарагдсан" },
  { value: "damaged", label: "Гэмтсэн / асгарсан" },
  { value: "sample", label: "Дээж, сурталчилгаанд өгсөн" },
  { value: "recount", label: "Дахин тоолсон — зөрүү" },
  { value: "other", label: "Бусад" },
];

/**
 * The one place source-bottle ml are changed by hand.
 *
 * Two directions, never one field that takes a sign. `RestockControl` used to
 * accept a negative number in the same "нөхөх" box, so a −20 produced a confirm
 * dialog reading «−20 мл нэмж, өртөгт 0 ₮ бүртгэнэ» and a restock_log row that
 * the profit report read as a purchase. Removing stock is a different act with
 * different consequences, so it gets its own mode, its own copy, and a required
 * reason — `restock_log` is the only record of why the count moved.
 */
export function StockAdjustDialog({
  open,
  onOpenChange,
  mode,
  productId,
  productLabel,
  onHandMl,
  reservedMl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: StockMode;
  productId: string;
  productLabel: string;
  onHandMl: number;
  reservedMl: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [reason, setReason] = React.useState(CORRECTION_REASONS[0].value);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const isRestock = mode === "restock";
  // Reserved ml belong to orders that are already placed. The server refuses to
  // go below them (0047); showing the number here means the refusal never
  // arrives as a surprise.
  const removable = Math.max(0, onHandMl - reservedMl);
  const qty = Math.max(0, Math.floor(Number(amount) || 0));
  const costValue = Math.max(0, Math.floor(Number(cost) || 0));

  // Reset per opening: a dialog reopened on another product must not carry the
  // previous row's numbers.
  React.useEffect(() => {
    if (open) {
      setAmount("");
      setCost("");
      setReason(CORRECTION_REASONS[0].value);
      setNote("");
    }
  }, [open]);

  const tooMany = !isRestock && qty > removable;
  const error = tooMany
    ? `Хамгийн ихдээ ${removable}ml хасах боломжтой — ${reservedMl}ml нь захиалагдсан.`
    : undefined;
  const canSubmit = qty > 0 && !tooMany && !busy;
  const nextOnHand = isRestock ? onHandMl + qty : onHandMl - qty;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      // Never report success we haven't verified: a swallowed failure here
      // means the shop sells against ml that were never added.
      const ok = await mutateJson(
        "/api/admin/inventory",
        "POST",
        {
          productId,
          delta: isRestock ? qty : -qty,
          reason: isRestock
            ? "restock"
            : [reason, note.trim()].filter(Boolean).join(": "),
          cost: isRestock ? costValue : 0,
        },
        isRestock ? "Үлдэгдэл нэмэгдсэнгүй" : "Залруулга хадгалагдсангүй",
      );
      if (!ok) return;
      toast.success(
        isRestock
          ? `${qty}ml нэмэгдэж, нөөц ${nextOnHand}ml боллоо.`
          : `${qty}ml хасагдаж, нөөц ${nextOnHand}ml боллоо.`,
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={busy ? () => {} : onOpenChange}
      title={isRestock ? "Нөөц нөхөх" : "Үлдэгдэл залруулах"}
      description={productLabel}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-md px-3 py-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Нөөц</dt>
            <dd className="tabular-nums">{onHandMl}ml</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Захиалагдсан</dt>
            <dd className="text-muted-foreground tabular-nums">
              {reservedMl}ml
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Боломжит</dt>
            <dd className="font-medium tabular-nums">{removable}ml</dd>
          </div>
        </dl>

        <Field
          label={isRestock ? "Нэмэх хэмжээ (ml)" : "Хасах хэмжээ (ml)"}
          error={error}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>

        {isRestock ? (
          <Field label="Худалдан авсан үнэ (₮)">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
            />
          </Field>
        ) : (
          <>
            <Field label="Шалтгаан">
              {/* Grouped, not free text: the profit report reads these back. */}
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORRECTION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Тайлбар (сонголтоор)">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Жишээ: Instagram-аар 20ml зарагдсан"
                maxLength={120}
              />
            </Field>
          </>
        )}

        {/* The consequence, spelled out. Restock feeds зардал in the profit
            report; a correction deliberately does not, or every write-off would
            read back as a purchase. */}
        <p
          className={cn(
            "rounded-md px-3 py-2 text-sm",
            qty > 0 && !tooMany
              ? "bg-secondary"
              : "text-muted-foreground bg-muted/40",
          )}
        >
          {qty <= 0 ? (
            isRestock ? (
              "Хэдэн мл ирснийг бичнэ үү."
            ) : (
              "Хэдэн мл хасахаа бичнэ үү."
            )
          ) : isRestock ? (
            <>
              Нөөц <span className="tabular-nums">{onHandMl}ml</span> →{" "}
              <span className="font-medium tabular-nums">{nextOnHand}ml</span>.
              Ашгийн тайлангийн зардалд{" "}
              <span className="tabular-nums">{formatPrice(costValue)}</span>{" "}
              нэмэгдэнэ.
            </>
          ) : (
            <>
              Нөөц <span className="tabular-nums">{onHandMl}ml</span> →{" "}
              <span className="font-medium tabular-nums">{nextOnHand}ml</span>.
              Худалдан авалт биш тул зардалд нэмэгдэхгүй, зөвхөн үлдэгдлийн
              түүхэнд бүртгэгдэнэ.
            </>
          )}
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isRestock ? (
              <Plus className="size-4" />
            ) : (
              <Minus className="size-4" />
            )}
            {busy
              ? "Хадгалж байна…"
              : isRestock
                ? "Нөөц нэмэх"
                : "Үлдэгдэл хасах"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
