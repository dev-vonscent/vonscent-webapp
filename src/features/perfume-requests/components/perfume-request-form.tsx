"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, useFieldProps } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { TextAutocomplete } from "@/components/shared/text-autocomplete";
import {
  perfumeRequestInputSchema,
  type PerfumeRequestFormValues,
} from "@/lib/validators/perfume-request";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import type { SearchHit, SearchResults } from "@/features/search/types";
import type { SubmitPerfumeRequestResponse } from "../types";

/** Radix Select хоосон утгатай сонголт зөвшөөрдөггүй. */
const UNKNOWN = "unknown";

interface ConcentrationChoice {
  code: string;
  label: string;
}

/**
 * Шинэ үнэртний санал (0137). Илгээхээс өмнө каталогоос хайж, ижил төстэй
 * бараа байвал «Энэ үү?» гэж асууна — байгаа барааг дахин санал болгуулахгүй.
 */
export function PerfumeRequestForm({
  defaults,
  brands,
  concentrations,
}: {
  defaults: { brand: string; name: string };
  brands: string[];
  concentrations: ConcentrationChoice[];
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [matches, setMatches] = React.useState<SearchHit[] | null>(null);
  const [done, setDone] = React.useState<{
    title: string;
    already: boolean;
  } | null>(null);
  // Каталогоос аль хэдийн шалгасан «брэнд + нэр» — дахин «Илгээх» дарахад
  // асуухгүй, шууд илгээнэ.
  const [checkedKey, setCheckedKey] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PerfumeRequestFormValues>({
    resolver: zodResolver(perfumeRequestInputSchema),
    defaultValues: {
      brand: defaults.brand,
      name: defaults.name,
      concentration: "",
      note: "",
    },
  });

  /** Каталогт ижил төстэй бараа. Хайлт бүтэлгүйтвэл саад болохгүй — []. */
  async function findInCatalog(brand: string, name: string) {
    try {
      const q = `${brand} ${name}`.trim().slice(0, 100);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=3`);
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: SearchResults };
      return data.results?.product ?? [];
    } catch {
      return [];
    }
  }

  async function submit(values: PerfumeRequestFormValues) {
    setServerError(null);
    const key = `${values.brand}\n${values.name}`.trim().toLowerCase();
    if (checkedKey !== key) {
      const found = await findInCatalog(values.brand, values.name);
      setCheckedKey(key);
      if (found.length > 0) {
        setMatches(found);
        return;
      }
    }
    setMatches(null);

    try {
      const res = await fetch("/api/perfume-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setServerError(limited);
        return;
      }
      if (res.status === 401) {
        setServerError(
          "Нэвтрэх хугацаа дууссан. Хуудсаа сэргээгээд дахин нэвтэрнэ үү.",
        );
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SubmitPerfumeRequestResponse;
      setDone({
        title: `${values.brand} ${values.name}`.trim(),
        already: data.alreadyRequested,
      });
    } catch {
      setServerError("Илгээхэд алдаа гарлаа. Дахин оролдоно уу.");
    }
  }

  function startOver() {
    reset({ brand: "", name: "", concentration: "", note: "" });
    setCheckedKey(null);
    setMatches(null);
    setDone(null);
  }

  if (done) {
    return (
      <div className="bg-card space-y-4 rounded-xl p-6 text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <h2 className="font-serif text-xl font-semibold">
          {done.already
            ? "Санал тань аль хэдийн бүртгэлтэй"
            : "Саналыг тань хүлээн авлаа"}
        </h2>
        <p className="text-muted-foreground text-sm">
          «{done.title}» —{" "}
          {done.already
            ? "та үүнийг өмнө нь санал болгосон байна."
            : "санал болгосонд баярлалаа. Олон хүний хүссэн үнэртнийг бид түрүүлж оруулж ирнэ."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={startOver}>Өөр үнэртэн санал болгох</Button>
          <Button asChild variant="outline">
            <Link href="/catalog">Каталог руу</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="bg-card space-y-4 rounded-xl p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Брэнд" error={errors.brand?.message}>
          <Controller
            control={control}
            name="brand"
            render={({ field }) => (
              <TextAutocomplete
                ref={field.ref}
                name={field.name}
                items={brands}
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  setMatches(null);
                }}
                onBlur={field.onBlur}
                placeholder="ж: Maison Francis Kurkdjian"
              />
            )}
          />
        </Field>
        <Field label="Үнэртний нэр" error={errors.name?.message}>
          <Input
            autoComplete="off"
            placeholder="ж: Baccarat Rouge 540"
            {...register("name", { onChange: () => setMatches(null) })}
          />
        </Field>
      </div>

      {concentrations.length > 0 && (
        <Field label="Төрөл" hint="Мэдэхгүй бол хоосон орхиорой.">
          <Controller
            control={control}
            name="concentration"
            render={({ field }) => (
              <Select
                value={field.value || UNKNOWN}
                onValueChange={(v) => field.onChange(v === UNKNOWN ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNKNOWN}>Мэдэхгүй</SelectItem>
                  {concentrations.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label && c.label !== c.code
                        ? `${c.code} — ${c.label}`
                        : c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <Field
        label="Нэмэлт тайлбар"
        hint="Хаана үнэрлэсэн, яагаад таалагдсан — заавал биш."
        error={errors.note?.message}
      >
        <NoteTextarea {...register("note")} />
      </Field>

      {matches && matches.length > 0 && (
        <div role="status" className="bg-secondary/60 space-y-3 rounded-lg p-4">
          <p className="text-sm font-medium">
            Энэ үнэртэн манайд аль хэдийн байгаа юм биш үү?
          </p>
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.href}
                  className="hover:bg-accent flex items-center gap-3 rounded-md p-1.5 transition-colors"
                >
                  <span className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
                    {m.imageUrl && (
                      <Image
                        src={m.imageUrl}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {m.title}
                    </span>
                    {m.subtitle && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {m.subtitle}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Эдгээрийн аль нь ч биш бол дахин «Илгээх» дарна уу.
          </p>
        </div>
      )}

      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}

      <LoadingButton loading={isSubmitting} type="submit" className="w-full">
        {matches && matches.length > 0 ? "Энэ биш — илгээх" : "Илгээх"}
      </LoadingButton>
    </form>
  );
}

const NoteTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(function NoteTextarea(props, ref) {
  const aria = useFieldProps(props);
  return (
    <textarea
      ref={ref}
      rows={3}
      maxLength={300}
      className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
      {...aria}
    />
  );
});
