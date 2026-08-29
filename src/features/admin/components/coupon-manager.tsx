"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminFetch, mutate, mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DatePicker } from "@/features/admin/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

/** Just enough of a profile to pick an owner for a personal coupon. */
export interface CouponCustomer {
  id: string;
  full_name: string;
  phone: string | null;
}

const PUBLIC = "__public__";

export function CouponManager({
  initial,
  customers = [],
}: {
  initial: CouponRow[];
  customers?: CouponCustomer[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [showForm, setShowForm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    code: "",
    type: "percent",
    value: "10",
    minSubtotal: "0",
    maxUses: "",
    maxUsesPerUser: "",
    userId: PUBLIC,
    endsAt: "",
  });

  const customerName = React.useMemo(
    () => new Map(customers.map((c) => [c.id, c.full_name || c.phone || "—"])),
    [customers],
  );

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
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
          userId: form.userId === PUBLIC ? null : form.userId,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          isActive: true,
        }),
      });
      if (!res.ok) {
        toast.error(res.error, "Купон үүсээгүй");
        return;
      }
      toast.success("Купон үүслээ.");
      {
        setForm({
          code: "",
          type: "percent",
          value: "10",
          minSubtotal: "0",
          maxUses: "",
          maxUsesPerUser: "",
          userId: PUBLIC,
          endsAt: "",
        });
        setShowForm(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

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
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold">
          Урамшуулал / Купон
        </h1>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="size-4" /> Купон үүсгэх
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
              <Field label="Код">
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  required
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
                  placeholder="Хязгааргүй"
                />
              </Field>
              <Field label="Нэг хүн хэдэн удаа">
                <Input
                  type="number"
                  value={form.maxUsesPerUser}
                  onChange={(e) => set("maxUsesPerUser", e.target.value)}
                  placeholder="Хязгааргүй"
                />
                <p className="text-muted-foreground text-xs">
                  Бөглөвөл зочноор захиалахад ашиглах боломжгүй — нэвтрэх
                  шаардлагатай (тоолохын тулд).
                </p>
              </Field>
              <Field label="Хэрэглэгч">
                <Select
                  value={form.userId}
                  onValueChange={(v) => set("userId", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PUBLIC}>
                      Бүх хэрэглэгч (нийтийн)
                    </SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name || "Нэргүй"}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Тодорхой хүнийг сонговол код зөвхөн тэр хүнд харагдаж,
                  ажиллана.
                </p>
              </Field>
              <Field
                label="Дуусах огноо"
                hint="Хоосон бол хугацаагүй."
              >
                <DatePicker
                  value={form.endsAt}
                  placeholder="Хугацаагүй"
                  onChange={(v) => set("endsAt", v)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  Хадгалах
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {initial.length === 0 ? (
        <p className="bg-muted/40 text-muted-foreground rounded-lg py-16 text-center text-sm">
          Купон алга.
        </p>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">Хямдрал</th>
                <th className="px-4 py-3 font-medium">Эзэмшигч</th>
                <th className="px-4 py-3 font-medium">Ашигласан</th>
                <th className="px-4 py-3 font-medium">Дуусах</th>
                <th className="px-4 py-3 font-medium">Төлөв</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {initial.map((c) => (
                <tr key={c.id} className="even:bg-muted/40">
                  <td className="px-4 py-3 font-mono font-semibold">
                    {c.code}
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
                  <td className="px-4 py-3">
                    {c.user_id ? (
                      <span className="flex items-center gap-1.5">
                        {customerName.get(c.user_id) ?? "Хэрэглэгч"}
                        {c.source_order_id && (
                          <Badge variant="secondary">Автомат</Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Нийтийн</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.used_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ""}
                    {c.max_uses_per_user && (
                      <span className="text-muted-foreground">
                        {" "}
                        · 1 хүнд {c.max_uses_per_user}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {c.ends_at ? formatDate(c.ends_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(c)}>
                      <Badge variant={c.is_active ? "new" : "secondary"}>
                        {c.is_active ? "Идэвхтэй" : "Идэвхгүй"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Устгах"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
