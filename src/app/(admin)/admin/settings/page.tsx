"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { saveSetting } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useUnsavedGuard } from "@/features/admin/lib/return-to";

export default function AdminSettingsPage() {
  const [confirm, confirmDialog] = useConfirm();
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
  });
  const [imageGen, setImageGen] = React.useState({
    enabled: true,
    basePrompt: "",
    size: "1024x1536",
    quality: "medium",
    autoOnCreate: true,
  });

  // Seven independent forms with seven save buttons used to share no state at
  // all: an operator who edited store info and a shipping zone, then pressed
  // one Хадгалах, silently lost the other. Each section now compares itself to
  // what was last written and says so.
  const [baseline, setBaseline] = React.useState<Record<string, string> | null>(
    null,
  );
  const snapshot = React.useMemo(
    () => ({
      store: JSON.stringify(store),
      collection: JSON.stringify(collection),
      imageGen: JSON.stringify(imageGen),
      shipping: JSON.stringify(zones),
      coupons: JSON.stringify(autoGrant),
      payment: JSON.stringify(invoiceCode),
    }),
    [store, collection, imageGen, zones, autoGrant, invoiceCode],
  );
  type SectionKey = keyof typeof snapshot;
  // Before the settings row has loaded there is nothing to compare against, so
  // nothing is dirty — otherwise the fetch itself would mark every section.
  const isDirty = (k: SectionKey) =>
    baseline !== null && baseline[k] !== snapshot[k];
  const commit = (k: SectionKey) =>
    setBaseline((b) => ({ ...(b ?? snapshot), [k]: snapshot[k] }));
  const anyDirty =
    baseline !== null &&
    (Object.keys(snapshot) as SectionKey[]).some(isDirty);

  useUnsavedGuard(anyDirty);

  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (loaded && baseline === null) setBaseline(snapshot);
  }, [loaded, baseline, snapshot]);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
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
        setLoaded(true);
      });
  }, []);

  /**
   * Deleting a zone changes what every customer in it pays at checkout, and
   * the change goes live on the next save — the most consequential one-click
   * action on this page.
   */
  async function removeZone(i: number) {
    const z = zones[i];
    if (
      !(await confirm({
        title: `«${z?.name || z?.code || `${i + 1}-р бүс`}» бүсийг устгах уу?`,
        description:
          "Энэ бүсийн хүргэлтийн төлбөр, хамрах хороод устна. Хадгалсны дараа тухайн бүсийн худалдан авагчид хүргэлт сонгох боломжгүй болно.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    setZones((zs) => zs.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <h1 className="font-serif text-2xl font-semibold">Тохиргоо</h1>

      {/* Store info */}
      <Saver
        title="Дэлгүүрийн мэдээлэл"
        onSave={() =>
          saveSetting("store", store, "Дэлгүүрийн мэдээлэл хадгалагдсангүй")
        }
        dirty={isDirty("store")}
        onSaved={() => commit("store")}
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
        title="Багц"
        onSave={() =>
          saveSetting(
            "collection",
            { ...collection, roundTo: 100 },
            "Багц хадгалагдсангүй",
          )
        }
        dirty={isDirty("collection")}
        onSaved={() => commit("collection")}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <Checkbox
                checked={collection.customEnabled}
                onCheckedChange={(c) =>
                  setCollection({
                    ...collection,
                    customEnabled: Boolean(c),
                  })
                }
              />
              Өөрөө угсрах багц идэвхтэй
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
            <Field
              label="Өөрөө угсарсан багцын хямдрал %"
              hint="Худалдан авагч өөрөө сонгож угсарсан багцад."
            >
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
            <Field
              label="Бэлэн багцын үндсэн хямдрал %"
              hint="Та урьдчилан бэлдсэн багцад анхдагчаар тавигдана."
            >
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
          </div>
        </div>
      </Saver>

      {/* AI image generation */}
      <Saver
        title="AI зураг үүсгэлт"
        onSave={() =>
          saveSetting("imageGen", imageGen, "AI зураг хадгалагдсангүй")
        }
        dirty={isDirty("imageGen")}
        onSaved={() => commit("imageGen")}
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <Checkbox
              checked={imageGen.enabled}
              onCheckedChange={(c) =>
                setImageGen({ ...imageGen, enabled: Boolean(c) })
              }
            />
            AI зураг үүсгэлт идэвхтэй
          </label>
          <Field label="AI зурагт өгөх үндсэн заавар (англиар бичнэ)">
            <textarea
              value={imageGen.basePrompt}
              onChange={(e) =>
                setImageGen({ ...imageGen, basePrompt: e.target.value })
              }
              rows={4}
              className="bg-secondary field-edge w-full rounded-md p-2 text-base md:text-sm"
              placeholder="Professional e-commerce product photo of a perfume bottle…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Хэмжээ">
              <Select
                value={imageGen.size}
                onValueChange={(v) => setImageGen({ ...imageGen, size: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1536">1024×1536 (босоо)</SelectItem>
                  <SelectItem value="1024x1024">
                    1024×1024 (дөрвөлжин)
                  </SelectItem>
                  <SelectItem value="1536x1024">1536×1024 (хэвтээ)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Чанар">
              <Select
                value={imageGen.quality}
                onValueChange={(v) => setImageGen({ ...imageGen, quality: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Бага</SelectItem>
                  <SelectItem value="medium">Дунд</SelectItem>
                  <SelectItem value="high">Өндөр</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Saver>

      {/* Shipping */}
      <Saver
        title="Хүргэлтийн бүс ба төлбөр"
        onSave={() =>
          saveSetting("shipping", { zones }, "Хүргэлтийн бүс хадгалагдсангүй")
        }
        dirty={isDirty("shipping")}
        onSaved={() => commit("shipping")}
      >
        <div className="space-y-3">
          {zones.map((z, i) => (
            <div key={i} className="bg-muted/40 space-y-3 rounded-lg p-2">
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
                {/* A live-money delete sitting in a wrapping row of five
                    inputs — it needs a real target, not a bare 16px icon. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeZone(i)}
                  className="hover:text-destructive shrink-0"
                  aria-label={`${z.name || z.code || `${i + 1}-р`} бүсийг устгах`}
                >
                  <Trash2 className="size-4" />
                </Button>
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
            variant="secondary"
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
        onSave={() =>
          saveSetting("coupons", { autoGrant }, "Купон хадгалагдсангүй")
        }
        dirty={isDirty("coupons")}
        onSaved={() => commit("coupons")}
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
        onSave={() =>
          saveSetting("payment", { invoiceCode }, "Төлбөр хадгалагдсангүй")
        }
        dirty={isDirty("payment")}
        onSaved={() => commit("payment")}
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

/**
 * One settings section: its own fields, its own save, and its own unsaved
 * marker. The marker is the point — this page stacks seven of these, so
 * "which of these did I actually save?" is a question the page has to answer
 * on its own rather than leaving the operator to remember.
 */
function Saver({
  title,
  children,
  onSave,
  dirty,
  onSaved,
}: {
  title: string;
  children: React.ReactNode;
  /** Resolves true when the write landed; `saveSetting` has already toasted. */
  onSave: () => Promise<boolean>;
  dirty: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  async function handle() {
    setBusy(true);
    try {
      if (await onSave()) {
        toast.success(`${title} хадгалагдлаа.`);
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          {dirty && (
            <Badge className="bg-warning/15 text-warning shrink-0">
              Хадгалаагүй
            </Badge>
          )}
        </div>
        {children}
        {/* Disabled when clean: a save that writes the same values back still
            reads as "something happened", which is how the operator learns to
            press all seven buttons every time. */}
        <Button onClick={handle} disabled={busy || !dirty}>
          {busy ? "Хадгалж байна…" : dirty ? "Хадгалах" : "Хадгалсан"}
        </Button>
      </CardContent>
    </Card>
  );
}
