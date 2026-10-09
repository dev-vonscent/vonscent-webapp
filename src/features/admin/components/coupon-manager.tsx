"use client";

import * as React from "react";
import Link from "next/link";
import { fieldErrorClass } from "@/components/ui/form-field";
import { useRouter } from "next/navigation";
import { adminFetch, mutate, mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DatePicker } from "@/features/admin/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingButton } from "@/components/shared/loading-button";
import { FormDrawer } from "./form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatPrice, formatDate } from "@/lib/format";
import type { CouponRow } from "@/db/types";
import { couponStatus } from "@/features/account/components/coupons";
import type { CouponTab } from "@/features/admin/lib/coupon-tabs";
import { CouponRedemptionsSheet } from "./coupon-redemptions-sheet";
import { CustomerPicker } from "./customer-picker";
import {
  customerLabel,
  type CustomerOption,
} from "@/features/admin/lib/customer-option";

const STATUS_BADGE = {
  active: { label: "Идэвхтэй", variant: "new" },
  used: { label: "Ашигласан", variant: "secondary" },
  expired: { label: "Дууссан", variant: "secondary" },
} as const;

/** Нэг табын купонууд. Шүүлт, хайлт, хуудаслалт нь серверт (URL). */
export function CouponTable({
  rows,
  tab,
  owners = [],
}: {
  rows: CouponRow[];
  tab: CouponTab;
  /** Энэ хуудсан дээрх хувийн купонуудын эзэд — нэр, утсыг харуулахад. */
  owners?: CustomerOption[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  /** The coupon whose usage log is open in the side sheet. */
  const [viewing, setViewing] = React.useState<CouponRow | null>(null);

  const ownerById = React.useMemo(
    () => new Map(owners.map((c) => [c.id, c])),
    [owners],
  );
  const ownerName = (id: string) => {
    const o = ownerById.get(id);
    return o ? customerLabel(o) : "Хэрэглэгч";
  };
  const hasOwner = tab !== "code";

  async function toggle(c: CouponRow) {
    const ok = await mutateJson(
      `/api/admin/coupons/${c.id}`,
      "PATCH",
      { isActive: !c.is_active },
      "Купон шинэчлэгдсэнгүй",
    );
    if (!ok) return;
    toast.success(c.is_active ? "Купон идэвхгүй боллоо." : "Купон идэвхжлээ.");
    router.refresh();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Купон устгах уу?",
      description: "Устгасан купоныг сэргээх боломжгүй.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    if (
      !(await mutate(
        `/api/admin/coupons/${id}`,
        { method: "DELETE" },
        "Купон устсангүй",
      ))
    )
      return;
    toast.success("Купон устлаа.");
    router.refresh();
  }

  return (
    <>
      {confirmDialog}
      <CouponRedemptionsSheet
        coupon={viewing}
        ownerName={viewing?.user_id ? ownerName(viewing.user_id) : null}
        onOpenChange={(open) => !open && setViewing(null)}
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th className="px-4 py-3 font-medium">Код</th>
              <th className="px-4 py-3 font-medium">Хямдрал</th>
              {hasOwner && <th className="px-4 py-3 font-medium">Эзэмшигч</th>}
              {tab === "auto" && (
                <th className="px-4 py-3 font-medium">Захиалга</th>
              )}
              <th className="px-4 py-3 font-medium">Ашигласан</th>
              <th className="px-4 py-3 font-medium">Дуусах</th>
              <th className="px-4 py-3 font-medium">Төлөв</th>
              <th className="px-4 py-3">
                <span className="sr-only">Үйлдэл</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const owner = c.user_id ? ownerById.get(c.user_id) : undefined;
              const state = couponStatus(c);
              const usage = couponUsageLabel(c);
              const status = STATUS_BADGE[state];
              return (
                <tr key={c.id} className="even:bg-muted/40">
                  <td className="px-4 py-3 font-mono font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className="underline-offset-2 hover:underline"
                      aria-label={`${c.code} — хэн ашигласныг харах`}
                    >
                      {c.code}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {c.type === "percent"
                      ? `${c.value}%`
                      : formatPrice(c.value)}
                    {c.min_subtotal > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatPrice(c.min_subtotal)}-аас
                      </span>
                    )}
                  </td>
                  {hasOwner && (
                    <td className="px-4 py-3">
                      {c.user_id ? (
                        <>
                          <div>{owner?.full_name || "Нэргүй"}</div>
                          {owner?.phone && (
                            <div className="text-muted-foreground text-xs tabular-nums">
                              {owner.phone}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {tab === "auto" && (
                    <td className="px-4 py-3">
                      {c.source_order_id ? (
                        <Link
                          href={`/admin/orders/${c.source_order_id}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          Харах
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums">
                    <div>{usage.used}</div>
                    <div className="text-muted-foreground text-xs">
                      {usage.limit}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {c.ends_at ? formatDate(c.ends_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      title={
                        c.is_active ? "Идэвхгүй болгох" : "Дахин идэвхжүүлэх"
                      }
                    >
                      <Badge variant={status.variant}>
                        {/* Admin-switched-off reads as its own word here:
                            it is the one "expired" this button can undo. */}
                        {state === "expired" && !c.is_active
                          ? "Идэвхгүй"
                          : status.label}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`${c.code} купоныг устгах`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/**
 * «Ашигласан» баганын хоёр мөр: хэдэн удаа ашигласан (нийт хязгаартай бол
 * «/ N»), доор нь хязгаар үгээр. Өмнө нь «0 / 1 · 1 хүнд 1» гэж бичигдэж,
 * хязгааргүй купон зүгээр «0» болдог байсан — уншихад ойлгомжгүй.
 */
export function couponUsageLabel(
  c: Pick<CouponRow, "used_count" | "max_uses" | "max_uses_per_user">,
): { used: string; limit: string } {
  const used =
    c.max_uses != null
      ? `${c.used_count} / ${c.max_uses} удаа`
      : `${c.used_count} удаа`;
  const limit =
    c.max_uses_per_user != null
      ? `Нэг хүн ${c.max_uses_per_user} удаа`
      : c.max_uses != null
        ? "Нэг хүнд хязгааргүй"
        : "Хязгааргүй";
  return { used, limit };
}

const FORM_ID = "coupon-create-form";

const EMPTY_FORM = {
  code: "",
  type: "percent",
  value: "10",
  minSubtotal: "0",
  maxUses: "",
  maxUsesPerUser: "",
  endsAt: "",
};

/**
 * «Купон үүсгэх» — товч ба маягт. `code` таб дээр нийтийн код, `personal`
 * дээр сонгосон хэрэглэгчийн купон үүсгэнэ.
 */
export function CouponCreateForm({
  mode,
  customerOptions = [],
}: {
  mode: "code" | "personal";
  /** Сонгогчийн эхний хуудас; цааш нь хайлтаар серверээс. */
  customerOptions?: CustomerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string>();
  const [ownerError, setOwnerError] = React.useState<string>();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [owner, setOwner] = React.useState<CustomerOption | null>(null);
  const personal = mode === "personal";

  const dirty =
    owner !== null || JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);

  function reset() {
    setForm(EMPTY_FORM);
    setOwner(null);
    setCodeError(undefined);
    setOwnerError(undefined);
  }

  function close() {
    reset();
    setOpen(false);
  }

  // Табаа солиход хагас бөглөсөн маягт нөгөө төрлөөр хадгалагдах ёсгүй.
  React.useEffect(() => {
    setOpen(false);
    setForm(EMPTY_FORM);
    setOwner(null);
    setCodeError(undefined);
    setOwnerError(undefined);
  }, [mode]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    let invalid = false;
    if (!form.code.trim()) {
      setCodeError("Код оруулна уу.");
      invalid = true;
    }
    if (personal && !owner) {
      setOwnerError("Хэрэглэгч сонгоно уу.");
      invalid = true;
    }
    if (invalid) return;
    setBusy(true);
    try {
      const res = await adminFetch<{ id?: string }>("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: Number(form.value),
          minSubtotal: Number(form.minSubtotal) || 0,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          maxUsesPerUser: form.maxUsesPerUser
            ? Number(form.maxUsesPerUser)
            : null,
          userId: personal ? (owner?.id ?? null) : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          isActive: true,
        }),
      });
      if (!res.ok) {
        toast.error(res.error, "Купон үүсээгүй");
        return;
      }
      toast.success("Купон үүслээ.");
      close();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const title = personal ? "Хувийн купон үүсгэх" : "Нийтийн купон үүсгэх";

  return (
    <>
      <Button size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {title}
      </Button>

      <FormDrawer
        open={open}
        dirty={dirty}
        onClose={close}
        title={title}
        description={
          personal
            ? "Сонгосон хэрэглэгчийн «Миний купон» хэсэгт харагдана."
            : "Кодыг мэддэг, нэвтэрсэн хэн ч ашиглана."
        }
        discardDescription="Бөглөсөн мэдээлэл тань хадгалагдахгүй."
        footer={
          <LoadingButton type="submit" form={FORM_ID} loading={busy}>
            Үүсгэх
          </LoadingButton>
        }
      >
        <form
          id={FORM_ID}
          onSubmit={create}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          {personal && (
            <Field
              label="Хэрэглэгч"
              error={ownerError}
              className="sm:col-span-2"
            >
              <CustomerPicker
                initial={customerOptions}
                value={owner}
                onChange={(o) => {
                  setOwner(o);
                  setOwnerError(undefined);
                }}
              />
            </Field>
          )}
          <Field label="Код" error={codeError}>
            <Input
              value={form.code}
              className={fieldErrorClass(codeError)}
              onChange={(e) => {
                set("code", e.target.value);
                setCodeError(undefined);
              }}
            />
          </Field>
          <Field label="Төрөл">
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Хувь (%)</SelectItem>
                <SelectItem value="fixed">Тогтсон дүн (₮)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={form.type === "percent" ? "Хувь" : "Дүн (₮)"}>
            <Input
              type="number"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
            />
          </Field>
          <Field label="Доод дүн (₮)">
            <Input
              type="number"
              value={form.minSubtotal}
              onChange={(e) => set("minSubtotal", e.target.value)}
            />
          </Field>
          <Field label="Ашиглах хязгаар (нийт)">
            <Input
              type="number"
              value={form.maxUses}
              onChange={(e) => set("maxUses", e.target.value)}
              placeholder={personal ? "1" : "Хязгааргүй"}
            />
            {personal && (
              <p className="text-muted-foreground text-xs">
                Хувийн купон заавал нийт хязгаартай — хоосон бол 1.
              </p>
            )}
          </Field>
          <Field label="Нэг хүн хэдэн удаа">
            <Input
              type="number"
              value={form.maxUsesPerUser}
              onChange={(e) => set("maxUsesPerUser", e.target.value)}
              placeholder="Хязгааргүй"
            />
            <p className="text-muted-foreground text-xs">
              Купон ямагт нэвтэрсэн хэрэглэгчид л ажиллана.
            </p>
          </Field>
          <Field label="Дуусах огноо" hint="Хоосон бол хугацаагүй.">
            <DatePicker
              value={form.endsAt}
              placeholder="Хугацаагүй"
              onChange={(v) => set("endsAt", v)}
            />
          </Field>
        </form>
      </FormDrawer>
    </>
  );
}
