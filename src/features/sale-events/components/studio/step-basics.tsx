"use client";

import * as React from "react";
import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fieldErrorClass } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/features/admin/components/date-picker";
import { SALE_EVENT_LIMITS as L, SITE } from "@/lib/constants";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { periodSentence, saleLink } from "./studio-model";
import type { EventStudio } from "./use-event-studio";

/**
 * ① Үндсэн (studio-ux.md §5.1): нэр, хэзээ, холбоос — гурван зүйл л. Холбоос
 * нэрээс автоматаар үүснэ; «Өөрчлөх» дарвал л талбар болно (D5).
 */
export function StepBasics({ studio }: { studio: EventStudio }) {
  const { draft, errors, today, phase } = studio;
  const [editingLink, setEditingLink] = React.useState(false);
  const link = saleLink(draft.slug);
  const sentence = periodSentence(draft.startsOn, draft.endsOn);
  const isPublished = phase === "scheduled" || phase === "live";
  // Алдаатай холбоосыг засахын тулд талбар нь нээлттэй байх ёстой.
  const linkOpen = editingLink || Boolean(errors.slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Холбоос хуулагдлаа.");
    } catch {
      toast.error("Хуулж чадсангүй — холбоосыг гараар сонгож хуулна уу.");
    }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <Field
        label="Нэр"
        hint="Энэ нэр каталогийн шүүлтүүрт харагдана."
        error={errors.name}
      >
        <Input
          value={draft.name}
          maxLength={L.name}
          placeholder="Жишээ: Black Friday, Цагаан сар"
          className={cn("h-14 rounded-xl px-4 text-lg md:text-lg", fieldErrorClass(errors.name))}
          onChange={(e) => studio.setName(e.target.value)}
        />
      </Field>

      <div className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Эхлэх өдөр" error={errors.startsOn}>
            <DatePicker
              value={draft.startsOn}
              placeholder="Огноо сонгох"
              clearable={false}
              onChange={(v) => studio.patch({ startsOn: v })}
            />
          </Field>
          <Field label="Дуусах өдөр" error={errors.endsOn}>
            <DatePicker
              value={draft.endsOn}
              placeholder="Огноо сонгох"
              clearable={false}
              min={draft.startsOn || today}
              onChange={(v) => studio.patch({ endsOn: v })}
            />
          </Field>
        </div>
        <p className="text-muted-foreground pt-1 text-sm text-pretty">
          {sentence ??
            "Эхлэх өдрийн 00:00-оос дуусах өдрийн 23:59 хүртэл үргэлжилнэ (Улаанбаатарын цагаар)."}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm leading-none font-medium">Холбоос</p>
        {linkOpen ? (
          <Field
            label={<span className="sr-only">Холбоосын төгсгөл</span>}
            hint="Латин жижиг үсэг, тоо, зураас."
            error={
              errors.slug
                ? `Холбоос ${L.slugMin}–${L.slugMax} тэмдэгт: латин жижиг үсэг, тоо, зураас.`
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground shrink-0 text-sm">
                {SITE.domain}/sale/
              </span>
              <Input
                value={draft.slug}
                maxLength={L.slugMax}
                placeholder="black-friday"
                autoCapitalize="none"
                spellCheck={false}
                className={fieldErrorClass(errors.slug)}
                onChange={(e) => studio.setSlug(e.target.value)}
              />
            </div>
          </Field>
        ) : (
          <div className="bg-secondary flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl py-2 pr-2 pl-4">
            <span className="min-w-0 flex-1 basis-40 text-sm break-all">
              <span className="text-muted-foreground">{SITE.domain}/sale/</span>
              <span className="font-medium">{draft.slug || "…"}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!draft.slug}
              onClick={copyLink}
            >
              <Copy />
              Хуулах
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingLink(true)}
            >
              <Pencil />
              Өөрчлөх
            </Button>
          </div>
        )}
        {linkOpen && isPublished && (
          <p className="text-warning text-sm" role="note">
            Холбоосыг өөрчилбөл өмнө тараасан холбоос ажиллахаа болино.
          </p>
        )}
        <p className="text-muted-foreground text-sm text-pretty">
          Сошиал пост, сторид энэ холбоосыг тавина.
          {studio.bannerEnabled && " Баннерын товч автоматаар энд холбогдоно."}
        </p>
      </div>
    </div>
  );
}
