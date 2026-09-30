"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MN_BANKS, REFUND_FEE_PCT } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { refundBreakdown } from "@/lib/refund";
import {
  refundAccountSchema,
  type RefundAccountInput,
} from "@/lib/validators/refund";
import { requestCancel } from "@/features/account/cancel-order";
import { useRefreshAndWait } from "@/features/account/use-refresh-and-wait";

type Errors = Partial<Record<keyof RefundAccountInput, string>>;

const EMPTY: RefundAccountInput = {
  bank: "" as RefundAccountInput["bank"],
  accountNumber: "",
  holderName: "",
};

/**
 * Төлсөн захиалгыг цуцлах цонх — буцаах дүн + буцаалтын данс (клиент,
 * 2026-09-30).
 *
 * QPay нь зөвхөн картын гүйлгээг буцаадаг тул бусад төлбөрийг админ гараар
 * шилжүүлнэ; данс нь урьд DM-ээр ирдэг байв. Буцаах дүнг (нийт − 1%)
 * цуцлахаас ӨМНӨ тоогоор нь харуулна — «шимтгэл хасагдана» гэдэг үг
 * ганцаараа хэд буцаж ирэхийг хэлдэггүй.
 *
 * «Захиалга цуцлах» дарахад цуцлалт + шинэ төлөв дэлгэцэнд буух хүртэл
 * товч loader-тэй, цонх нээлттэй; дараа нь хаагдана.
 */
export function RefundCancelDialog({
  orderId,
  total,
  open,
  onOpenChange,
}: {
  orderId: string;
  /** Захиалгын нийт төлсөн дүн (хүргэлт орсон). */
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useRefreshAndWait();
  const [values, setValues] = React.useState<RefundAccountInput>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const { fee, amount } = refundBreakdown(total);

  function set<K extends keyof RefundAccountInput>(
    key: K,
    value: RefundAccountInput[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    // Засаж эхэлмэгц тухайн талбарын алдааг арилгана.
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = refundAccountSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RefundAccountInput;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    setServerError(null);
    const result = await requestCancel(orderId, values);
    if (!result.ok) {
      setServerError(result.message);
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog
      open={open}
      // Ажил явж байхад хаагдахгүй — хагас хийгдсэн цуцлалтыг «болих» гэж
      // ойлгоно.
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title="Захиалга цуцлах"
      description="Төлсөн мөнгийг тань буцааж шилжүүлэх дансаа бичнэ үү."
      className="sm:max-w-md"
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <dl className="bg-secondary space-y-1.5 rounded-lg p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Төлсөн дүн</dt>
            <dd className="tabular-nums">{formatPrice(total)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              Банкны шимтгэл ({REFUND_FEE_PCT}%)
            </dt>
            <dd className="tabular-nums">−{formatPrice(fee)}</dd>
          </div>
          <div className="flex justify-between gap-3 pt-1.5 text-base font-semibold">
            <dt>Буцаах дүн</dt>
            <dd className="tabular-nums">{formatPrice(amount)}</dd>
          </div>
        </dl>

        <div className="space-y-4">
          <Field label="Банк" error={errors.bank}>
            <Select
              value={values.bank || undefined}
              onValueChange={(v) =>
                set("bank", v as RefundAccountInput["bank"])
              }
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue placeholder="Банкаа сонгоно уу" />
              </SelectTrigger>
              <SelectContent>
                {MN_BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Дансны дугаар"
            hint="Дансны дугаар эсвэл MN-ээр эхэлсэн IBAN"
            error={errors.accountNumber}
          >
            <Input
              value={values.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="font-mono tracking-wide"
            />
          </Field>
          <Field label="Данс эзэмшигчийн нэр" error={errors.holderName}>
            <Input
              value={values.holderName}
              onChange={(e) => set("holderName", e.target.value)}
              autoComplete="name"
              disabled={busy}
            />
          </Field>
        </div>

        <p className="text-muted-foreground text-sm">
          Цуцалсан захиалгыг сэргээх боломжгүй — шинээр захиалга үүсгэх
          шаардлагатай.
        </p>

        {serverError && (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="px-5"
          >
            Буцах
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            disabled={busy}
            aria-busy={busy}
            className="flex-1"
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Захиалга цуцлах
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
