"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

type FieldCtx = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

const Ctx = React.createContext<FieldCtx | null>(null);

/**
 * Label ↔ control-ыг гараар `htmlFor`/`id` бичихгүйгээр холбоно.
 * `Input`, `SelectTrigger`, `Textarea` энэ контекстээс `id`, `aria-*`-аа авна
 * (WCAG 1.3.1 / 3.3.1 / 3.3.2).
 *
 * <Field label="Код" error={errors.code}>
 *   <Input value={...} onChange={...} />
 * </Field>
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Ctx.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
        {children}
      </Ctx.Provider>
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      <FieldError id={id} message={error} />
    </div>
  );
}

type FieldAria = React.AriaAttributes & { id?: string };

/** Контролууд өөрсдийн `id`/`aria-*`-г үүнээс залгана. */
export function useFieldProps<T extends FieldAria>(own: T): T {
  const ctx = React.useContext(Ctx);
  if (!ctx) return own;
  return {
    ...own,
    id: own.id ?? ctx.id,
    "aria-describedby": own["aria-describedby"] ?? ctx.describedBy,
    "aria-invalid": own["aria-invalid"] ?? (ctx.invalid || undefined),
  };
}
