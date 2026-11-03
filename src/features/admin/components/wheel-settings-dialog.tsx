"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LoadingButton } from "@/components/shared/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatPrice } from "@/lib/format";
import type {
  GrandBundleChoice,
  WheelSettings,
} from "@/features/admin/api";

/** Radix Select has no empty value — this stands for «no bundle». */
const NONE = "none";

/** `settings.spin` is saved whole — the route replaces the row. */
function useSaveSettings() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  async function save(settings: WheelSettings, done: string) {
    setSaving(true);
    const ok = await mutateJson(
      "/api/admin/lucky-wheel",
      "PUT",
      { settings },
      "Хадгалж чадсангүй",
    );
    setSaving(false);
    if (ok) {
      toast.success(done);
      router.refresh();
    }
    return ok;
  }
  return { save, saving };
}

/**
 * Labels stay one line so the inputs in a row line up; anything longer goes
 * to the hint under the input.
 */
function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}

/** Эрх, купон, гранд багц — хүрдний ерөнхий тохиргоо. */
export function WheelSettingsDialog({
  open,
  onOpenChange,
  settings,
  bundleChoices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: WheelSettings;
  bundleChoices: GrandBundleChoice[];
}) {
  const [c, setC] = React.useState(settings);
  const { save, saving } = useSaveSettings();
  const set = (patch: Partial<WheelSettings>) =>
    setC((v) => ({ ...v, ...patch }));

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Хүрдний тохиргоо"
      className="sm:max-w-2xl"
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Эргэлтийн эрх</h3>
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <NumberField
              label="Үнэгүй эргэлт (цаг)"
              hint="Сүүлийн үнэгүй эргэлтээс хойш"
              value={c.freeSpinHours}
              onChange={(n) => set({ freeSpinHours: n })}
            />
            <NumberField
              label="Захиалгын эрх (₮)"
              hint="Энэ дүн тутамд 1 эрх · 0 = унтраах"
              value={c.orderSpinStep}
              onChange={(n) => set({ orderSpinStep: n })}
            />
            <NumberField
              label="Пойнтоор эргүүлэх (V)"
              hint="Нэмэлт нэг эргэлтийн үнэ"
              value={c.spinCost}
              onChange={(n) => set({ spinCost: n })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Купон ба хязгаар</h3>
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <NumberField
              label="Купоны хугацаа (хоног)"
              hint="Хожсоноос хойш хүчинтэй"
              value={c.couponValidDays}
              onChange={(n) => set({ couponValidDays: n })}
            />
            <NumberField
              label="Сарын V point дээд"
              hint="Нэг хэрэглэгч · 0 = хязгааргүй"
              value={c.monthlyPointCap}
              onChange={(n) => set({ monthlyPointCap: n })}
            />
            <NumberField
              label="Ховор купон / сар"
              hint="Нэг хэрэглэгч · 0 = хязгааргүй"
              value={c.rareCouponPerMonth}
              onChange={(n) => set({ rareCouponPerMonth: n })}
            />
          </div>
          <label className="flex w-fit items-center gap-2 text-sm">
            <Checkbox
              checked={c.singleActiveCoupon}
              onCheckedChange={(v) => set({ singleActiveCoupon: v === true })}
            />
            Хүрднээс ашиглагдаагүй купон нэг дор нэг л байна
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Бодит шагнал</h3>
          <div className="grid items-start gap-3 sm:grid-cols-3">
            {(["male", "female"] as const).map((g) => (
              <Field
                key={g}
                label={`${g === "male" ? "Эрэгтэй" : "Эмэгтэй"} багц`}
                hint="Гранд шагналын 2мл багц"
              >
                <Select
                  value={c.grandBundles[g] ?? NONE}
                  onValueChange={(v) =>
                    set({
                      grandBundles: {
                        ...c.grandBundles,
                        [g]: v === NONE ? null : v,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Сонгоогүй" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Сонгоогүй</SelectItem>
                    {/* Эрэгтэй шагналд эрэгтэй + unisex, эмэгтэйд эмэгтэй +
                        unisex — эсрэг хүйсийн багц санал болгохгүй. */}
                    {bundleChoices
                      .filter((b) => b.gender === g || b.gender === "unisex")
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} · {formatPrice(b.price)}
                          {b.available ? "" : " · 2мл дууссан"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
            <NumberField
              label="Авах хугацаа (хоног)"
              hint="Хожсоноос хойш захиалгад авах"
              value={c.bundleClaimDays}
              onChange={(n) => set({ bundleClaimDays: n })}
            />
          </div>
        </section>

        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={c.enabled}
            onCheckedChange={(v) => set({ enabled: v === true })}
          />
          Хүрд нээлттэй (унтраавал хэн ч эргүүлэхгүй)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <LoadingButton
            loading={saving}
            onClick={async () => {
              if (await save(c, "Тохиргоо хадгалагдлаа")) onOpenChange(false);
            }}
          >
            Хадгалах
          </LoadingButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}

/** «Хоосон» дээр гарах зөвлөгөө (0170) — санамсаргүй нэгийг харуулна. */
export function MissTipsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: WheelSettings;
}) {
  const [tips, setTips] = React.useState(settings.missTips);
  const { save, saving } = useSaveSettings();
  const edit = (i: number, patch: Partial<(typeof tips)[number]>) =>
    setTips((all) => all.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Хоосон дээр гарах зөвлөгөө"
      description="Шагнал таараагүй үед «Энэ удаад шагнал таарсангүй»-н доор эдгээрээс нэгийг санамсаргүйгээр харуулна."
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        <ol className="space-y-3">
          {tips.map((tip, i) => (
            <li key={i} className="bg-secondary/50 space-y-2 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Input
                  value={tip.title}
                  maxLength={80}
                  placeholder="Гарчиг"
                  aria-label={`${i + 1}-р зөвлөгөөний гарчиг`}
                  onChange={(e) => edit(i, { title: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive shrink-0"
                  aria-label="Зөвлөгөө хасах"
                  onClick={() => setTips((all) => all.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <textarea
                value={tip.body}
                maxLength={400}
                rows={3}
                placeholder="Текст"
                aria-label={`${i + 1}-р зөвлөгөөний текст`}
                className="bg-secondary field-edge w-full rounded-md px-3 py-2 text-base md:text-sm"
                onChange={(e) => edit(i, { body: e.target.value })}
              />
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          size="sm"
          disabled={tips.length >= 20}
          onClick={() => setTips((all) => [...all, { title: "", body: "" }])}
        >
          <Plus className="size-3.5" />
          Зөвлөгөө нэмэх
        </Button>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <LoadingButton
            loading={saving}
            onClick={async () => {
              const missTips = tips.filter(
                (t) => t.title.trim() && t.body.trim(),
              );
              if (
                await save({ ...settings, missTips }, "Зөвлөгөө хадгалагдлаа")
              )
                onOpenChange(false);
            }}
          >
            Хадгалах
          </LoadingButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
