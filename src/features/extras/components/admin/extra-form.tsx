"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import {
  extraSaveSchema,
  EXTRA_DESCRIPTION_MAX,
} from "@/lib/validators/extras";
import type {
  AdminExtra,
  ExtraCategory,
  ExtraMode,
  VialOption,
} from "../../types";
import { draftMissing } from "../../lib/readiness";
import { ExtraCard } from "../extra-card";
import {
  draftOf,
  emptyDraft,
  relistDraft,
  toSavePayload,
  type ExtraDraft,
} from "./extra-draft";
import { ExtraImagesField } from "./extra-images-field";
import { ExtraLeftoverFields, leftoverMaxMl } from "./extra-leftover-fields";
import {
  ExtraLocalVariants,
  type LocalVariantKind,
} from "./extra-local-variants";
import { ExtraPublishPanel } from "./extra-publish-panel";
import { ExtraVialVariants } from "./extra-vial-variants";

const SECTION_TITLE: Record<ExtraDraft["mode"], string> = {
  local_quantity: "Хувилбар",
  shared_vial: "Сав ба үнэ",
  leftover_liquid: "Шил",
};

/** Zod-ийн алдааг `variants.0.price` маягийн түлхүүрээр. */
function issuesByPath(
  issues: { path: (string | number)[]; message: string }[],
) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".");
    out[key] ??= i.message;
  }
  return out;
}

/** Маягтаас дэлгүүрийн карт — «Дэлгүүрт ингэж харагдана». */
function previewOf(d: ExtraDraft, category: ExtraCategory) {
  const priced = (p: string) => Number(p.replace(/[\s,]/g, ""));
  const prices =
    d.mode === "leftover_liquid"
      ? [priced(d.leftoverPrice)]
      : d.variants.filter((v) => v.isActive).map((v) => priced(v.price));
  const valid = prices.filter((n) => Number.isFinite(n) && n > 0);
  return {
    id: "preview",
    slug: "preview",
    name: d.name.trim() || "Барааны нэр",
    categoryName: category.name,
    categorySlug: category.slug,
    mode: d.mode,
    image: d.images[0] ?? d.leftover?.productImage ?? null,
    fromPrice: valid.length ? Math.min(...valid) : 0,
    soldOut: false,
    leftover: d.leftover
      ? {
          brand: d.leftover.productBrand,
          productName: d.leftover.productName,
          remainingMl: Number(d.leftover.remainingMl) || 0,
          fullMl: Number(d.leftover.fullMl) || 0,
        }
      : null,
    bottleMl: Number(d.bottleMl) > 0 ? Number(d.bottleMl) : null,
    stock: null,
    notice: "",
    requiresConsent: false,
  };
}

/**
 * Нэмэлт барааны маягт — горим бүр өөрийн урсгалтай (plan §7.2). Админ аль
 * тоо жинхэнэ нөөц болохыг бодох шаардлагагүй: энгийн бараанд тоо, грамын
 * савд зөвхөн үнэ, үлдэгдэлтэй шилэнд ml.
 */
export function ExtraForm({
  category,
  mode,
  extra,
  relistFrom,
  vials,
}: {
  category: ExtraCategory;
  /** Зарагдсан үлдэгдэлтэй шилээс «Дахин нийтлэх» — хадгалсны дараа архивлана. */
  relistFrom?: AdminExtra | null;
  /** Шинэ барааны горим — «Шилтэй ус»-д ангиллаас биш сонголтоос. */
  mode?: ExtraMode;
  /** null = шинэ бараа. */
  extra: AdminExtra | null;
  vials: VialOption[];
}) {
  const router = useRouter();
  const initial = React.useMemo(
    () =>
      extra
        ? draftOf(extra)
        : relistFrom
          ? relistDraft(relistFrom)
          : emptyDraft(mode ?? category.modes[0]!.mode),
    [extra, relistFrom, mode, category.modes],
  );
  const [draft, setDraft] = React.useState<ExtraDraft>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const messageRef = React.useRef<HTMLParagraphElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const savedVariants = React.useMemo(
    () => new Map((extra?.variants ?? []).map((v) => [v.id, v])),
    [extra],
  );
  const missing = draftMissing(draft, vials);
  const patch = (p: Partial<ExtraDraft>) => setDraft((d) => ({ ...d, ...p }));

  React.useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  /** Хадгална; амжилттай бол барааны id. */
  async function save(): Promise<string | null> {
    setMessage(null);
    const parsed = extraSaveSchema.safeParse(toSavePayload(draft));
    let found = parsed.success ? {} : issuesByPath(parsed.error.issues);
    if (
      draft.mode === "leftover_liquid" &&
      draft.leftover &&
      Number(draft.leftover.remainingMl) >
        leftoverMaxMl(draft.leftover, extra?.leftover ?? null)
    ) {
      found = { ...found, remainingMl: found.remainingMl ?? "" };
    }
    setErrors(found);
    if (!parsed.success || Object.keys(found).length > 0) {
      setMessage(
        "Маягтад алдаа байна — улаанаар тэмдэглэсэн талбаруудыг засна уу.",
      );
      return null;
    }
    setSaving(true);
    const res = extra
      ? await adminFetch<{ id: string }>(`/api/admin/extras/${extra.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        })
      : await adminFetch<{ id: string }>("/api/admin/extras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: category.id, extra: parsed.data }),
        });
    setSaving(false);
    if (!res.ok) {
      setMessage(res.error);
      return null;
    }
    if (!extra && relistFrom && relistFrom.status !== "archived") {
      // Хуучин (зарагдсан) шил дэлгүүрээс гарна; борлуулалтын түүх үлдэнэ.
      await adminFetch(`/api/admin/extras/${relistFrom.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
    }
    toast.success(
      extra ? "Хадгалагдлаа" : "Бараа нэмэгдлээ — ноорог хэлбэрээр",
    );
    if (!extra) {
      router.replace(`/admin/extras/${res.data.id}`);
    } else {
      router.refresh();
    }
    return res.data.id;
  }

  const preview = previewOf(draft, category);
  // Хоосон шил ба «Шилтэй ус»-ны бүтэн шил batch code-оор (plan §18.4).
  const variantKind: LocalVariantKind =
    category.slug === "empty-bottle" || category.slug === "bottled"
      ? "batch"
      : category.slug === "gift-box"
        ? "gift"
        : "plain";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <Field label="Нэр" error={errors["name"]}>
                <Input
                  value={draft.name}
                  maxLength={120}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Тайлбар" error={errors["description"]}>
                <textarea
                  value={draft.description}
                  maxLength={EXTRA_DESCRIPTION_MAX}
                  rows={4}
                  onChange={(e) => patch({ description: e.target.value })}
                  className="bg-secondary field-edge w-full rounded-md px-3 py-2 text-base md:text-sm"
                />
              </Field>
              {variantKind === "batch" && draft.mode === "local_quantity" && (
                <Field
                  label="Бүтэн савны хэмжээ (ml)"
                  hint={
                    category.slug === "empty-bottle"
                      ? "Дэлгүүрт «0/125ml» гэж харагдана."
                      : "Дэлгүүрт «100/100ml» гэж харагдана."
                  }
                  error={errors["bottleMl"]}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft.bottleMl}
                    placeholder="125"
                    className="max-w-32 tabular-nums"
                    onChange={(e) => patch({ bottleMl: e.target.value })}
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          {/* Зураг тусдаа карт — нэр/тайлбар ба хувилбарын дунд. */}
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <div className="space-y-1">
                <h2 className="font-medium">Зураг</h2>
                <p className="text-muted-foreground text-xs">
                  {draft.mode === "leftover_liquid"
                    ? "Оруулаагүй бол эх үнэртний зураг харагдана."
                    : "Эхний зураг нь каталогийн картад гарна. Чирж байрлалыг солино."}
                </p>
              </div>
              <ExtraImagesField
                value={draft.images}
                onChange={(images) => patch({ images })}
                gridClassName="grid-cols-3 sm:grid-cols-5 xl:grid-cols-6"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <h2 className="font-medium">{SECTION_TITLE[draft.mode]}</h2>
              {draft.mode === "local_quantity" && (
                <ExtraLocalVariants
                  kind={variantKind}
                  productName={draft.name || category.name}
                  variants={draft.variants}
                  saved={savedVariants}
                  errors={errors}
                  onChange={(variants) => patch({ variants })}
                />
              )}
              {draft.mode === "shared_vial" && (
                <ExtraVialVariants
                  vials={vials}
                  variants={draft.variants}
                  errors={errors}
                  onChange={(variants) => patch({ variants })}
                />
              )}
              {draft.mode === "leftover_liquid" && (
                <ExtraLeftoverFields
                  value={draft.leftover}
                  price={draft.leftoverPrice}
                  saved={extra?.leftover ?? null}
                  errors={errors}
                  onChange={(leftover) => patch({ leftover })}
                  onPriceChange={(leftoverPrice) => patch({ leftoverPrice })}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <ExtraPublishPanel
            extra={extra}
            dirty={dirty}
            missing={missing}
            saving={saving}
            onSave={save}
          />
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-6">
              <h2 className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
                Дэлгүүрт ингэж харагдана
              </h2>
              <ExtraCard
                extra={preview}
                className="max-w-48 lg:max-w-none"
                sizes="(min-width: 1024px) 320px, 192px"
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      {message && (
        <p
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className="bg-secondary rounded-md px-4 py-3 text-sm"
        >
          {message}
        </p>
      )}

      {/* Утсан дээр «Хадгалах» доод талд байнга (plan §7.2). */}
      <div className="bg-background/85 sticky bottom-0 -mx-4 flex items-center gap-3 px-4 py-3 backdrop-blur max-md:-mb-8 max-md:pb-[max(env(safe-area-inset-bottom),0.75rem)] md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <LoadingButton
          loading={saving}
          type="submit"
          size="lg"
          className="flex-1 md:flex-none"
        >
          Хадгалах
        </LoadingButton>
        <Button asChild type="button" variant="secondary" size="lg">
          <Link href="/admin/extras">Болих</Link>
        </Button>
      </div>
    </form>
  );
}
