"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_LIMITS as L,
} from "@/lib/constants";
import type { EventStudio } from "./use-event-studio";

/**
 * ③ Каталогт харагдах — S1-ийн ТҮР хувилбар: одоогийн талбарууд энгийн
 * маягтаар. S2-д каталогийн жишээ харагдац дээр газар дээр нь засдаг болно
 * (studio-ux.md §5.3, D4).
 */
export function StepCatalog({ studio }: { studio: EventStudio }) {
  const { draft, errors } = studio;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Field
        label="Гарчиг"
        hint="Каталогийн дээд хэсэгт, арга хэмжээний зурваст. Хоосон бол нэр харагдана."
        error={errors.headline}
      >
        <Input
          value={draft.headline}
          maxLength={L.headline}
          placeholder={draft.name || "Black Friday — 30% хүртэл"}
          onChange={(e) => studio.patch({ headline: e.target.value })}
        />
      </Field>
      <Field
        label="Тайлбар"
        hint={`Гарчгийн доор — заавал биш. ${draft.description.length}/${L.description}`}
        error={errors.description}
      >
        <textarea
          rows={3}
          maxLength={L.description}
          value={draft.description}
          placeholder="Сонгосон үнэртнүүд хямдарлаа."
          onChange={(e) => studio.patch({ description: e.target.value })}
          className="bg-secondary placeholder:text-muted-foreground field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
        />
      </Field>
      <Field
        label="Барааны картын тэмдэг"
        hint={`Арга хэмжээний бараа бүрийн картын буланд. Хоосон бол «${SALE_EVENT_DEFAULT_BADGE}».`}
        error={errors.badgeLabel}
      >
        <Input
          value={draft.badgeLabel}
          maxLength={L.badgeLabel}
          placeholder={SALE_EVENT_DEFAULT_BADGE}
          onChange={(e) => studio.patch({ badgeLabel: e.target.value })}
        />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={draft.showCountdown}
          onCheckedChange={(v) => studio.patch({ showCountdown: v === true })}
        />
        <span>
          Дуусах тоолуур харуулах
          <span className="text-muted-foreground block text-xs">
            Зурваст «Дуусахад 2 өдөр 4 цаг» гэж гарна.
          </span>
        </span>
      </label>
    </div>
  );
}
