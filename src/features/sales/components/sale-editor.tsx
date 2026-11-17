"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Square, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingButton } from "@/components/shared/loading-button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { BackLink } from "@/features/admin/components/back-link";
import { DatePicker } from "@/features/admin/components/date-picker";
import { PeriodHint } from "@/features/admin/components/period-hint";
import { ubToday } from "@/features/admin/lib/date-range";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { PhaseBadge } from "@/features/sale-events/components/phase-badge";
import type { SalePhase } from "@/features/products/sale";
import { GENDERS, GENDER_LABEL, ML_SIZES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  BULK_SALE_MAX_PCT,
  NAMED_SALE_NAME_MAX,
  bulkSalePrice,
} from "@/lib/validators/sale";
import type { Gender } from "@/db/types";
import {
  UNNAMED_SALE_ID,
  productsWithoutDiscount,
  validPcts,
  type SalePcts,
  type SaleProductRow,
} from "../lib";

const LIST_HREF = "/admin/sales";

export interface SaleEditorInitial {
  /** null = шинэ; `UNNAMED_SALE_ID` = «Нэргүй»-г нэрлэх; бусад нь uuid. */
  id: string | null;
  name: string;
  pcts: SalePcts;
  startsOn: string;
  endsOn: string;
  productIds: string[];
  phase: SalePhase | null;
}

type Filter = "all" | "selected" | "free";

/**
 * Нэртэй хямдрал үүсгэх / засах (16.2–16.6). Нэр заавал (16.2); өөр
 * дуусаагүй хямдралд орсон бараа харагдах ч сонгогдохгүй, аль хямдралд
 * байгааг хэлнэ (16.3); засахад нэр, хугацаа (сунгах), бараа, хувь өөрчлөгдөнө,
 * явж буйг одоо дуусгана (16.4); бараа бүрт дор хаяж нэг хэмжээ хямдрах ёстой
 * (16.5). Сервер (`save_sale`) бүгдийг дахин шалгана.
 */
export function SaleEditor({
  initial,
  products,
  busy,
}: {
  initial: SaleEditorInitial;
  products: SaleProductRow[];
  /** productId → тэр барааг эзэмшиж буй өөр (дуусаагүй) хямдралын нэр. */
  busy: Record<string, string>;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const isNew = initial.id == null;
  const isUnnamed = initial.id === UNNAMED_SALE_ID;

  const [name, setName] = React.useState(isUnnamed ? "" : initial.name);
  const [pctRaw, setPctRaw] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      ML_SIZES.map((ml) => [
        String(ml),
        initial.pcts[String(ml)] != null
          ? String(initial.pcts[String(ml)])
          : "",
      ]),
    ),
  );
  const [startsOn, setStartsOn] = React.useState(initial.startsOn);
  const [endsOn, setEndsOn] = React.useState(initial.endsOn);
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initial.productIds),
  );
  const [conflicts, setConflicts] = React.useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [gender, setGender] = React.useState<Gender | "all">("all");
  const [brand, setBrand] = React.useState("all");
  const [filter, setFilter] = React.useState<Filter>("all");

  const today = ubToday();
  const pcts = validPcts(pctRaw, BULK_SALE_MAX_PCT);
  const blockedBy = React.useMemo(
    () => ({ ...busy, ...conflicts }),
    [busy, conflicts],
  );

  const brands = React.useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products],
  );
  const visible = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (gender !== "all" && p.gender !== gender) return false;
      if (brand !== "all" && p.brand !== brand) return false;
      if (filter === "selected" && !selected.has(p.id)) return false;
      if (filter === "free" && blockedBy[p.id]) return false;
      return !term || `${p.brand} ${p.name}`.toLowerCase().includes(term);
    });
  }, [products, q, gender, brand, filter, selected, blockedBy]);
  const selectable = visible.filter((p) => !blockedBy[p.id]);
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  // ── Шалгалт (сервер ч дахин) ──────────────────────────────────────────
  const pctTooHigh = Object.values(pctRaw).some(
    (raw) => raw.trim() && Number(raw) > BULK_SALE_MAX_PCT,
  );
  const bare = productsWithoutDiscount(products, selected, pcts);
  const errors = {
    name: name.trim() ? undefined : "Хямдралын нэр оруулна уу.",
    pcts: pctTooHigh
      ? `Хувь ${BULK_SALE_MAX_PCT}%-иас ихгүй.`
      : Object.keys(pcts).length === 0
        ? "Дор хаяж нэг хэмжээнд хувь оруулна уу."
        : undefined,
    endsOn: !endsOn
      ? "Дуусах өдөр сонгоно уу."
      : startsOn && endsOn < startsOn
        ? "Дуусах өдөр эхлэхээс өмнө байж болохгүй."
        : isNew && endsOn < today
          ? "Дуусах өдөр өнгөрсөн байна."
          : undefined,
    products:
      selected.size === 0
        ? "Дор хаяж нэг бараа сонгоно уу."
        : bare.length > 0
          ? `Эдгээр бараа 4 хэмжээ бүгд хямдралгүй үлдэнэ (хувь өгсөн хэмжээ нь зарагддаггүй): ${bare
              .map((p) => p.name)
              .join(", ")}. Хувь нэмэх эсвэл барааг хасна уу.`
          : Object.keys(conflicts).some((id) => selected.has(id))
            ? "Улаанаар тэмдэглэсэн бараа өөр хямдралд орсон байна — хасна уу."
            : undefined,
  };
  const hasError = Object.values(errors).some(Boolean);
  const bareIds = new Set(bare.map((p) => p.id));

  function toggle(id: string) {
    if (blockedBy[id] && !selected.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of selectable) {
        if (allVisibleSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function save() {
    setShowErrors(true);
    if (hasError) {
      toast.error("Улаанаар тэмдэглэсэн талбаруудыг засна уу.");
      return;
    }
    setSaving(true);
    const body = {
      name: name.trim(),
      pcts,
      startsOn,
      endsOn,
      productIds: [...selected],
      adoptUnnamed: isUnnamed,
    };
    const res = await adminFetch<{
      id?: string;
      conflicts?: { productId: string; sale: string }[];
    }>(
      isNew || isUnnamed
        ? "/api/admin/sales/named"
        : `/api/admin/sales/named/${initial.id}`,
      {
        method: isNew || isUnnamed ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);
    if (!res.ok) {
      // 16.3: хадгалах зуур өөр админ барааг авсан бол мөрийг улаанаар.
      const list = res.data?.conflicts ?? [];
      if (list.length) {
        setConflicts(
          Object.fromEntries(list.map((c) => [c.productId, c.sale])),
        );
      }
      toast.error(res.error, "Хямдрал хадгалагдсангүй");
      return;
    }
    toast.success(`«${body.name}» хадгалагдлаа.`);
    router.push(LIST_HREF);
    router.refresh();
  }

  async function endNow() {
    const ok = await confirm({
      title: `«${initial.name}»-г одоо дуусгах уу?`,
      description:
        "Бүх барааны үнэ яг одоо үндсэн үнэ рүүгээ буцна. Хямдрал жагсаалтад «Дууссан» болж үлдэнэ.",
      confirmLabel: "Дуусгах",
      destructive: true,
    });
    if (!ok) return;
    const done = await mutateJson(
      `/api/admin/sales/named/${initial.id}/end`,
      "POST",
      {},
      "Дуусгаж чадсангүй",
    );
    if (!done) return;
    toast.success(`«${initial.name}» дууслаа.`);
    router.push(LIST_HREF);
    router.refresh();
  }

  async function remove() {
    const ok = await confirm({
      title: `«${initial.name}»-г устгах уу?`,
      description:
        "Хямдрал бүрэн устаж, түүнд орсон бараанууд энгийн үнэ рүүгээ буцна.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    const done = await mutateJson(
      `/api/admin/sales/named/${initial.id}`,
      "DELETE",
      {},
      "Устгасангүй",
    );
    if (!done) return;
    toast.success("Хямдрал устлаа.");
    router.push(LIST_HREF);
    router.refresh();
  }

  const err = (e: string | undefined) => (showErrors ? e : undefined);
  const title = isNew
    ? "Шинэ хямдрал"
    : isUnnamed
      ? "Нэргүй хямдрал"
      : initial.name;

  return (
    <div className="space-y-6">
      {confirmDialog}
      <BackLink
        href={LIST_HREF}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Хямдрал
      </BackLink>

      <PageHeader
        title={title}
        description={
          isUnnamed
            ? "Нэргүйгээр тавьсан хуучин хямдралууд. Нэр өгч хадгалбал нэг нэртэй хямдрал болно — жагсаалтаас хассан бараа, хувьгүй хэмжээ энгийн үнэ рүүгээ буцна."
            : undefined
        }
        actions={
          initial.phase && (
            <PhaseBadge
              phase={initial.phase === "active" ? "live" : initial.phase}
            />
          )
        }
      />

      {/* ── Нэр, хувь, хугацаа ─────────────────────────────────────────── */}
      <section className="bg-card space-y-4 rounded-lg p-4">
        <Field
          label="Хямдралын нэр"
          error={err(errors.name)}
          className="max-w-md"
        >
          <Input
            value={name}
            maxLength={NAMED_SALE_NAME_MAX}
            placeholder="Жишээ: Март 8, Намрын хямдрал"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end gap-3">
            {ML_SIZES.map((ml) => (
              <label key={ml} className="space-y-1 text-xs">
                <span className="text-muted-foreground block">{ml}ml (%)</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={BULK_SALE_MAX_PCT}
                  className="h-11 w-24 md:h-9"
                  placeholder="—"
                  value={pctRaw[String(ml)] ?? ""}
                  onChange={(e) =>
                    setPctRaw((p) => ({ ...p, [String(ml)]: e.target.value }))
                  }
                />
              </label>
            ))}
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground block">Бүх хэмжээнд</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={BULK_SALE_MAX_PCT}
                className="h-11 w-24 md:h-9"
                placeholder="%"
                onChange={(e) =>
                  setPctRaw(
                    Object.fromEntries(
                      ML_SIZES.map((ml) => [String(ml), e.target.value]),
                    ),
                  )
                }
              />
            </label>
          </div>
          <p
            className={cn(
              "text-xs",
              err(errors.pcts) ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {err(errors.pcts) ??
              "Хувь нь хэмжээний үндсэн үнээс бодогдож 100₮-д тоймлогдоно. Хоосон хэмжээ хямдрахгүй."}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Эхлэх өдөр" className="w-56">
              <DatePicker
                value={startsOn}
                placeholder="Одооноос"
                onChange={setStartsOn}
              />
            </Field>
            <Field
              label="Дуусах өдөр"
              className="w-56"
              error={err(errors.endsOn)}
            >
              <DatePicker
                value={endsOn}
                placeholder="Огноо сонгох"
                clearable={false}
                min={
                  isNew
                    ? startsOn && startsOn > today
                      ? startsOn
                      : today
                    : startsOn || undefined
                }
                onChange={setEndsOn}
              />
            </Field>
          </div>
          <PeriodHint
            startsOn={startsOn}
            endsOn={endsOn}
            today={today}
            fallback="Эхлэх өдрийн 00:00-оос дуусах өдрийн 23:59 хүртэл, Улаанбаатарын цагаар."
          />
        </div>
      </section>

      {/* ── Бараа ────────────────────────────────────────────────────── */}
      <section className="bg-card space-y-3 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Брэнд / нэр"
              aria-label="Бараа хайх"
              className="w-56 pl-9"
            />
          </div>
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as Gender | "all")}
          >
            <SelectTrigger className="w-36" aria-label="Хүйс">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх хүйс</SelectItem>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {GENDER_LABEL[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="w-44" aria-label="Брэнд">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх брэнд</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-44" aria-label="Шүүлтүүр">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх бараа</SelectItem>
              <SelectItem value="selected">Сонгосон</SelectItem>
              <SelectItem value="free">Өөр хямдралгүй</SelectItem>
            </SelectContent>
          </Select>
          {(q || gender !== "all" || brand !== "all" || filter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setGender("all");
                setBrand("all");
                setFilter("all");
              }}
            >
              <X />
              Шүүлтүүр цэвэрлэх
            </Button>
          )}
          <span className="text-muted-foreground ml-auto text-sm">
            {selected.size} сонгосон
          </span>
        </div>
        {err(errors.products) && (
          <p className="text-destructive text-sm">{errors.products}</p>
        )}

        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-180 text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Харагдаж буй бүх барааг сонгох"
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Бүгд ({visible.length})
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Хэмжээ · үнэ
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const owner = blockedBy[p.id];
                const isSelected = selected.has(p.id);
                // Өөр хямдралд байгаа, сонгоогүй бараа — харагдах ч сонгогдохгүй.
                const disabled = Boolean(owner) && !isSelected;
                const flagged =
                  showErrors &&
                  isSelected &&
                  (bareIds.has(p.id) || Boolean(conflicts[p.id]));
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "even:bg-muted/40",
                      disabled ? "text-muted-foreground" : "cursor-pointer",
                      flagged && "bg-destructive/10 even:bg-destructive/10",
                    )}
                    aria-disabled={disabled || undefined}
                    onClick={() => !disabled && toggle(p.id)}
                  >
                    <td className="px-3 py-2 align-top">
                      <Checkbox
                        aria-label={`${p.name} сонгох`}
                        checked={isSelected}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggle(p.id)}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">
                        {p.name}
                        {owner && (
                          <span
                            className={cn(
                              "ml-1.5 text-xs font-normal",
                              conflicts[p.id]
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            — «{owner}»
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {p.brand} · {GENDER_LABEL[p.gender]}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                        {p.variants
                          .filter((v) => v.isActive && v.price > 0)
                          .map((v) => {
                            const pct = isSelected
                              ? pcts[String(v.ml)]
                              : undefined;
                            return (
                              <span key={v.ml}>
                                <span className="text-muted-foreground">
                                  {v.ml}ml{" "}
                                </span>
                                {pct ? (
                                  <>
                                    <span className="text-muted-foreground line-through">
                                      {formatPrice(v.price)}
                                    </span>{" "}
                                    <span className="text-primary font-semibold">
                                      {formatPrice(bulkSalePrice(v.price, pct))}
                                    </span>
                                  </>
                                ) : (
                                  formatPrice(v.price)
                                )}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Доод action bar — бараа олон (88+) тул жагсаалтын төгсгөлд биш,
          дэлгэцэд наалдаж үргэлж харагдана (арга хэмжээний студитэй ижил хэв
          маяг, event-studio.tsx). */}
      <div
        role="toolbar"
        aria-label="Хямдралын үйлдэл"
        className="bg-card/85 shadow-lift sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl p-2 backdrop-blur"
      >
        <span className="text-muted-foreground px-2 text-sm tabular-nums">
          {selected.size} бараа сонгосон
        </span>
        {showErrors && hasError && (
          <span className="text-destructive px-2 text-sm">
            Алдаатай талбар байна
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isNew && !isUnnamed && initial.phase === "active" && (
            <Button variant="outline" onClick={endNow}>
              <Square className="size-4" />
              Одоо дуусгах
            </Button>
          )}
          {!isNew && !isUnnamed && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={remove}
            >
              <Trash2 className="size-4" />
              Устгах
            </Button>
          )}
          <LoadingButton loading={saving} onClick={save}>
            {isNew ? "Хямдрал үүсгэх" : "Хадгалах"}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
