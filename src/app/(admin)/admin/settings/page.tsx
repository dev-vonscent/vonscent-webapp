"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHIPPING_ZONES,
  type ShippingZoneConfig,
} from "@/lib/constants";
import { ZoneAreas } from "@/features/admin/components/zone-areas";
import { createClient } from "@/lib/supabase/browser";

async function saveSetting(key: string, value: unknown) {
  await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export default function AdminSettingsPage() {
  const [store, setStore] = React.useState({
    name: "vonscent",
    phone: "",
    email: "hello@vonscent.mn",
    address: "Улаанбаатар",
  });
  const [zones, setZones] = React.useState<ShippingZoneConfig[]>([
    ...SHIPPING_ZONES,
  ]);
  const [freeOver, setFreeOver] = React.useState(150000);
  const [invoiceCode, setInvoiceCode] = React.useState("");
  const [autoGrant, setAutoGrant] = React.useState({
    enabled: false,
    minTotal: 300000,
    type: "percent",
    value: 10,
    validDays: 30,
    maxUsesPerUser: 1,
  });

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data }) => {
        for (const row of (data as { key: string; value: unknown }[] | null) ?? []) {
          const v = row.value as Record<string, unknown>;
          if (row.key === "store" && v) setStore((s) => ({ ...s, ...(v as object) }));
          if (row.key === "shipping" && v) {
            if (Array.isArray(v.zones)) {
              // Rows saved before deliverable/remote existed default to a
              // normal, deliverable city zone.
              setZones(
                (v.zones as Partial<ShippingZoneConfig>[]).map((z) => ({
                  name: String(z.name ?? ""),
                  fee: Number(z.fee) || 0,
                  deliverable: z.deliverable !== false,
                  remote: z.remote === true,
                  areas: Array.isArray(z.areas) ? z.areas : [],
                })),
              );
            }
            if (v.freeOver) setFreeOver(Number(v.freeOver));
          }
          if (row.key === "coupons" && v && v.autoGrant)
            setAutoGrant((g) => ({ ...g, ...(v.autoGrant as object) }));
          if (row.key === "payment" && v) setInvoiceCode(String(v.invoiceCode ?? ""));
        }
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Тохиргоо</h1>

      {/* Store info */}
      <Saver title="Дэлгүүрийн мэдээлэл" onSave={() => saveSetting("store", store)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Нэр">
            <Input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
          </Field>
          <Field label="Утас">
            <Input value={store.phone} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
          </Field>
          <Field label="Имэйл">
            <Input value={store.email} onChange={(e) => setStore({ ...store, email: e.target.value })} />
          </Field>
          <Field label="Хаяг">
            <Input value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
          </Field>
        </div>
      </Saver>

      {/* Shipping */}
      <Saver
        title="Хүргэлтийн бүс ба төлбөр"
        onSave={() => saveSetting("shipping", { zones, freeOver })}
      >
        <div className="space-y-3">
          {zones.map((z, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
              <Input
                value={z.name}
                onChange={(e) =>
                  setZones((zs) => zs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Бүсийн нэр"
                className="min-w-40 flex-1"
              />
              <Input
                type="number"
                className="w-32"
                value={z.fee}
                disabled={!z.deliverable}
                onChange={(e) =>
                  setZones((zs) =>
                    zs.map((x, j) => (j === i ? { ...x, fee: Number(e.target.value) || 0 } : x)),
                  )
                }
                placeholder="Төлбөр"
              />
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs">
                <Checkbox
                  checked={z.deliverable}
                  onCheckedChange={(c) =>
                    setZones((zs) =>
                      zs.map((x, j) =>
                        j === i ? { ...x, deliverable: Boolean(c) } : x,
                      ),
                    )
                  }
                />
                Хүргэнэ
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs">
                <Checkbox
                  checked={z.remote}
                  onCheckedChange={(c) =>
                    setZones((zs) =>
                      zs.map((x, j) => (j === i ? { ...x, remote: Boolean(c) } : x)),
                    )
                  }
                />
                Орон нутаг
              </label>
              <button
                onClick={() => setZones((zs) => zs.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
              </div>
              <ZoneAreas
                areas={z.areas ?? []}
                onChange={(areas) =>
                  setZones((zs) =>
                    zs.map((x, j) => (j === i ? { ...x, areas } : x)),
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setZones((zs) => [
                ...zs,
                { name: "", fee: 0, deliverable: true, remote: false, areas: [] },
              ])
            }
          >
            <Plus className="size-4" /> Бүс нэмэх
          </Button>
          <p className="text-xs text-muted-foreground">
            «Хүргэнэ» тэмдэглэгээг авбал тухайн бүсийг сонгосон хэрэглэгч
            захиалга өгөх боломжгүй болно. «Орон нутаг» бол унаа явах газраа
            бичихийг сануулна. Хамрах газар нутгийг бөглөвөл checkout дээр бүс
            нь хаягаас автоматаар тодорхойлогдоно (хороо нь дүүргээсээ давуу).
          </p>
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label>Үнэгүй хүргэлтийн босго (₮)</Label>
          <Input
            type="number"
            value={freeOver}
            onChange={(e) => setFreeOver(Number(e.target.value) || 0)}
          />
        </div>
      </Saver>

      {/* Automatic reward coupon */}
      <Saver
        title="Автомат купон"
        onSave={() => saveSetting("coupons", { autoGrant })}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={autoGrant.enabled}
            onCheckedChange={(c) =>
              setAutoGrant({ ...autoGrant, enabled: Boolean(c) })
            }
          />
          Идэвхжүүлэх
        </label>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Захиалгын доод дүн (₮)">
            <Input
              type="number"
              value={autoGrant.minTotal}
              onChange={(e) =>
                setAutoGrant({
                  ...autoGrant,
                  minTotal: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Хямдралын төрөл">
            <Select
              value={autoGrant.type}
              onValueChange={(v) => setAutoGrant({ ...autoGrant, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Хувь (%)</SelectItem>
                <SelectItem value="fixed">Тогтсон дүн (₮)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={autoGrant.type === "percent" ? "Хувь" : "Дүн (₮)"}>
            <Input
              type="number"
              value={autoGrant.value}
              onChange={(e) =>
                setAutoGrant({
                  ...autoGrant,
                  value: Number(e.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Хүчинтэй хугацаа (хоног)">
            <Input
              type="number"
              value={autoGrant.validDays}
              onChange={(e) =>
                setAutoGrant({
                  ...autoGrant,
                  validDays: Number(e.target.value) || 1,
                })
              }
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Төлбөр нь баталгаажсан захиалга энэ дүнгээс давбал худалдан авагчид
          зөвхөн түүнд зориулсан купон автоматаар үүснэ. Зочны захиалгад
          үүсэхгүй (хаана хадгалах бүртгэл байхгүй).
        </p>
      </Saver>

      {/* Payment */}
      <Saver
        title="Төлбөрийн тохиргоо (QPay)"
        onSave={() => saveSetting("payment", { invoiceCode })}
      >
        <Field label="QPay Invoice Code">
          <Input
            value={invoiceCode}
            onChange={(e) => setInvoiceCode(e.target.value)}
            placeholder="QPAY_INVOICE_CODE"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          QPay-ийн нэвтрэх нууц мэдээлэл (username/password) нь серверийн орчны
          хувьсагчид (env) хадгалагдана.
        </p>
      </Saver>

      {/* Admin users / roles */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="font-serif text-lg font-semibold">
            Админ хэрэглэгч ба эрхийн түвшин
          </h2>
          <p className="text-sm text-muted-foreground">
            Хэрэглэгчдэд оператор / супер админ эрх олгох, хураах үйлдлийг{" "}
            <Link href="/admin/customers" className="text-primary hover:underline">
              Хэрэглэгч
            </Link>{" "}
            хэсгээс хийнэ. (Эрх өөрчлөхөд super admin шаардлагатай.)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Saver({
  title,
  children,
  onSave,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => Promise<void>;
}) {
  const [saved, setSaved] = React.useState(false);
  async function handle() {
    await onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {children}
        <Button onClick={handle}>{saved ? "Хадгалагдлаа ✓" : "Хадгалах"}</Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
