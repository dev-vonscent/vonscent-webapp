"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ImageUpload } from "@/features/admin/components/image-upload";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { GiftCardFace } from "../gift-card-face";
import type { AdminGiftCardDesign } from "../../admin-api";

const HEX = /^#[0-9a-fA-F]{6}$/u;

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="border-border size-9 shrink-0 rounded-md border"
          style={{ backgroundColor: HEX.test(value) ? value : "transparent" }}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0E1B3B"
          className="font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}

/**
 * Нэг загварын засвар (gift-cards-plan §9.2): дэвсгэр зураг (текстгүй,
 * 1200×756 харьцаа), гарчиг, санал болгох мэндчилгээ, 3 өнгө. Live preview.
 */
export function GiftCardDesignEditor({ design }: { design: AdminGiftCardDesign }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [v, setV] = React.useState(design);
  const set = <K extends keyof AdminGiftCardDesign>(k: K, value: AdminGiftCardDesign[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const ok = await mutateJson(
      `/api/admin/gift-card-designs/${design.id}`,
      "PATCH",
      {
        title: v.title,
        heading: v.heading,
        defaultMessage: v.defaultMessage ?? "",
        imageUrl: v.imageUrl,
        bgColor: v.bgColor,
        textColor: v.textColor,
        mutedColor: v.mutedColor,
        accentColor: v.accentColor || null,
        sortOrder: v.sortOrder,
        isActive: v.isActive,
      },
      "Хадгалж чадсангүй",
    );
    setPending(false);
    if (ok) {
      toast.success("Загвар хадгалагдлаа.");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden="true" /> Засах
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={`Загвар: ${design.title}`}
        className="md:max-w-3xl"
      >
        <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3 md:order-2">
            <GiftCardFace
              design={{
                ...v,
                defaultMessage: v.defaultMessage,
                accentColor: v.accentColor,
              }}
              text={{
                amount: 100000,
                recipientName: "Сараа",
                message: "",
                fromName: "Болд",
              }}
            />
            <p className="text-muted-foreground text-xs">
              Дэвсгэр зураг: 2400×1512 (1200×756 харьцаа), текстгүй. Нэр, дүн,
              мэндчилгээг систем өөрөө тавина; чимэглэл баруун талд.
            </p>
            <ImageUpload
              folder="gift-cards"
              label="Дэвсгэр зураг"
              value={v.imageUrl}
              onChange={(url) => set("imageUrl", url)}
            />
          </div>
          <div className="space-y-3 md:order-1">
            <div className="space-y-1.5">
              <Label htmlFor="d-title">Нэр (сонголтод)</Label>
              <Input id="d-title" value={v.title} maxLength={40} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-heading">Карт дээрх гарчиг</Label>
              <Input id="d-heading" value={v.heading} maxLength={60} onChange={(e) => set("heading", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-message">Санал болгох мэндчилгээ</Label>
              <textarea
                id="d-message"
                rows={3}
                maxLength={120}
                value={v.defaultMessage ?? ""}
                onChange={(e) => set("defaultMessage", e.target.value)}
                className="bg-secondary field-edge flex w-full resize-none rounded-md px-3 py-2 text-base md:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField id="d-bg" label="Дэвсгэр" value={v.bgColor} onChange={(c) => set("bgColor", c)} />
              <ColorField id="d-text" label="Үндсэн текст" value={v.textColor} onChange={(c) => set("textColor", c)} />
              <ColorField id="d-muted" label="Бүдэг текст" value={v.mutedColor} onChange={(c) => set("mutedColor", c)} />
              <ColorField id="d-accent" label="Өргөлт" value={v.accentColor ?? ""} onChange={(c) => set("accentColor", c || null)} />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="d-sort">Эрэмбэ</Label>
                <Input
                  id="d-sort"
                  type="number"
                  inputMode="numeric"
                  className="w-24"
                  value={v.sortOrder}
                  onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={v.isActive}
                  onCheckedChange={(c) => set("isActive", c === true)}
                />
                Хэрэглэгчид харагдана
              </label>
            </div>
            <LoadingButton type="submit" loading={pending} className="w-full">
              Хадгалах
            </LoadingButton>
          </div>
        </form>
      </ResponsiveDialog>
    </>
  );
}
