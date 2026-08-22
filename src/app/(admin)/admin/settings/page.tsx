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
import { SHIPPING_ZONES, type ShippingZoneConfig } from "@/lib/constants";
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
  const [invoiceCode, setInvoiceCode] = React.useState("");
  const [autoGrant, setAutoGrant] = React.useState({
    enabled: false,
    minTotal: 300000,
    type: "percent",
    value: 10,
    validDays: 30,
    maxUsesPerUser: 1,
  });
  const [collection, setCollection] = React.useState({
    customEnabled: true,
    minItems: 4,
    maxItems: null as number | null,
    customDiscountPct: 5,
    baseDefaultDiscountPct: 5,
    giftEnabled: true,
    giftMl: 1,
  });
  const [imageGen, setImageGen] = React.useState({
    enabled: true,
    basePrompt: "",
    size: "1024x1536",
    quality: "medium",
    autoOnCreate: true,
  });

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data }) => {
        for (const row of (data as { key: string; value: unknown }[] | null) ??
          []) {
          const v = row.value as Record<string, unknown>;
          if (row.key === "store" && v)
            setStore((s) => ({ ...s, ...(v as object) }));
          if (row.key === "shipping" && v) {
            if (Array.isArray(v.zones)) {
              // Rows saved before deliverable/remote existed default to a
              // normal, deliverable city zone.
              setZones(
                (v.zones as Partial<ShippingZoneConfig>[]).map((z) => ({
                  // Rows saved before codes existed keep the name as their id.
                  code: String(z.code ?? z.name ?? ""),
                  name: String(z.name ?? ""),
                  fee: Number(z.fee) || 0,
                  deliverable: z.deliverable !== false,
                  remote: z.remote === true,
                  areas: Array.isArray(z.areas) ? z.areas : [],
                })),
              );
            }
          }
          if (row.key === "coupons" && v && v.autoGrant)
            setAutoGrant((g) => ({ ...g, ...(v.autoGrant as object) }));
          if (row.key === "payment" && v)
            setInvoiceCode(String(v.invoiceCode ?? ""));
          if (row.key === "collection" && v)
            setCollection((c) => ({ ...c, ...(v as object) }));
          if (row.key === "imageGen" && v)
            setImageGen((g) => ({ ...g, ...(v as object) }));
        }
      });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">Тохиргоо</h1>

      {/* Store info */}
      <Saver
        title="Дэлгүүрийн мэдээлэл"
        onSave={() => saveSetting("store", store)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Нэр">
            <Input
              value={store.name}
              onChange={(e) => setStore({ ...store, name: e.target.value })}
            />
          </Field>
          <Field label="Утас">
            <Input
              value={store.phone}
              onChange={(e) => setStore({ ...store, phone: e.target.value })}
            />
          </Field>
          <Field label="Имэйл">
            <Input
              value={store.email}
              onChange={(e) => setStore({ ...store, email: e.target.value })}
            />
          </Field>
          <Field label="Хаяг">
            <Input
              value={store.address}
              onChange={(e) => setStore({ ...store, address: e.target.value })}
            />
          </Field>
        </div>
      </Saver>

      {/* Collections (Багц) */}
      <Saver
        title="Багц (Collection)"
        onSave={() =>
          saveSetting("collection", {
            ...collection,
            giftMlOptions: [1, 2],
            roundTo: 100,
          })
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={collection.customEnabled}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    customEnabled: e.target.checked,
                  })
                }
                className="size-4"
              />
              Custom багц идэвхтэй
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={collection.giftEnabled}
                onChange={(e) =>
                  setCollection({ ...collection, giftEnabled: e.target.checked })
                }
                className="size-4"
              />
              Нэмэлт бэлэг идэвхтэй
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Доод үнэртэн (min)">
              <Input
                type="number"
                value={collection.minItems}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    minItems: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Дээд үнэртэн (max, хоосон = хязгааргүй)">
              <Input
                type="number"
                value={collection.maxItems ?? ""}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    maxItems:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Custom хямдрал %">
              <Input
                type="number"
                value={collection.customDiscountPct}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    customDiscountPct: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Base default хямдрал %">
              <Input
                type="number"
                value={collection.baseDefaultDiscountPct}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    baseDefaultDiscountPct: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Бэлгийн ml (default)">
              <Input
                type="number"
                value={collection.giftMl}
                onChange={(e) =>
                  setCollection({
                    ...collection,
                    giftMl: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </div>
      </Saver>

      {/* AI image generation */}
      <Saver
        title="AI зураг үүсгэлт"
        onSave={() => saveSetting("imageGen", imageGen)}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={imageGen.enabled}
              onChange={(e) =>
                setImageGen({ ...imageGen, enabled: e.target.checked })
              }
              className="size-4"
            />
            AI зураг үүсгэлт идэвхтэй
          </label>
          <Field label="Үндсэн prompt (англи)">
            <textarea
              value={imageGen.basePrompt}
              onChange={(e) =>
                setImageGen({ ...imageGen, basePrompt: e.target.value })
              }
              rows={4}
              className="border-border bg-background w-full rounded-md border p-2 text-sm"
              placeholder="Professional e-commerce product photo of a perfume bottle…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Хэмжээ">
              <select
                value={imageGen.size}
                onChange={(e) =>
                  setImageGen({ ...imageGen, size: e.target.value })
                }
                className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="1024x1536">1024×1536 (босоо)</option>
                <option value="1024x1024">1024×1024 (дөрвөлжин)</option>
                <option value="1536x1024">1536×1024 (хэвтээ)</option>
              </select>
            </Field>
            <Field label="Чанар">
              <select
                value={imageGen.quality}
                onChange={(e) =>
                  setImageGen({ ...imageGen, quality: e.target.value })
                }
                className="border-border bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="low">Бага</option>
                <option value="medium">Дунд</option>
                <option value="high">Өндөр</option>
              </select>
            </Field>
          </div>
        </div>
      </Saver>

      {/* Shipping */}
      <Saver
        title="Хүргэлтийн бүс ба төлбөр"
        onSave={() => saveSetting("shipping", { zones })}
      >
        <div className="space-y-3">
          {zones.map((z, i) => (
            <div
              key={i}
              className="border-border space-y-3 rounded-lg border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* The code is the zone's identity (stored on orders); the name
                  beside it is only what customers read, so renaming is safe. */}
                <Input
                  value={z.code}
                  onChange={(e) =>
                    setZones((zs) =>
                      zs.map((x, j) =>
                        j === i
                          ? { ...x, code: e.target.value.toUpperCase() }
                          : x,
                      ),
                    )
                  }
                  placeholder="A"
                  maxLength={4}
                  className="w-16 text-center font-mono"
                />
                <Input
                  value={z.name}
                  onChange={(e) =>
                    setZones((zs) =>
                      zs.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
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
                      zs.map((x, j) =>
                        j === i
                          ? { ...x, fee: Number(e.target.value) || 0 }
                          : x,
                      ),
                    )
                  }
                  placeholder="Төлбөр"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap">
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
                <label className="flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap">
                  <Checkbox
                    checked={z.remote}
                    onCheckedChange={(c) =>
                      setZones((zs) =>
                        zs.map((x, j) =>
                          j === i ? { ...x, remote: Boolean(c) } : x,
                        ),
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
                {
                  code: "",
                  name: "",
                  fee: 0,
                  deliverable: true,
                  remote: false,
                  areas: [],
                },
              ])
            }
          >
            <Plus className="size-4" /> Бүс нэмэх
          </Button>
          <p className="text-muted-foreground text-xs">
            Эхний нүд бол бүсийн <b>код</b> (A/B/C/R/X) — захиалга дээр
            хадгалагдах тогтвортой утга, өөрчлөхгүй байхыг зөвлөнө. Хажуугийн
            нэр болон төлбөрийг хэзээ ч чөлөөтэй засаж болно. «Хүргэнэ»
            тэмдэглэгээг авбал тухайн бүсийг сонгосон хэрэглэгч захиалга өгөх
            боломжгүй болно. «Орон нутаг» бол унаа явах газраа бичихийг
            сануулна. Хамрах газар нутгийг бөглөвөл checkout дээр бүс нь хаягаас
            автоматаар тодорхойлогдоно (хороо нь дүүргээсээ давуу).
          </p>
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
        <p className="text-muted-foreground text-xs">
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
        <p className="text-muted-foreground text-xs">
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
          <p className="text-muted-foreground text-sm">
            Хэрэглэгчдэд оператор / супер админ эрх олгох, хураах үйлдлийг{" "}
            <Link
              href="/admin/customers"
              className="text-gold-strong hover:underline"
            >
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
        <Button onClick={handle}>
          {saved ? "Хадгалагдлаа ✓" : "Хадгалах"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
