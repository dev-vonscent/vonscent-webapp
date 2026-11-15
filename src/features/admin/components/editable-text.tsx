"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Газар дээр нь засах текстийн утга: мөр таслалгүй, хязгаараас хэтрэхгүй
 * (studio-ux.md §6.1-4). Paste хийсэн олон мөр нэг мөр болно.
 */
export function sanitizeInline(text: string, max: number): string {
  return text.replace(/[\r\n]+/gu, " ").slice(0, max);
}

/**
 * Харагдац дээр, байгаа газраа засагдах текст (studio-ux.md §6.1, §6.3).
 *
 * Эцэг элементийн typography-г өвлөсөн `<textarea>` нь үл үзэгдэх толин
 * (mirror) span-тай нэг grid нүдэнд давхарлана — хэмжээ нь текстээ дагана
 * (`field-sizing`-д найдахгүй). Үргэлж талбар хэвээр: Tab-аар хүрнэ, screen
 * reader-т `aria-label`-тай талбар гэж уншигдана.
 *
 *   · hover / focus — хүрээ + нэрийн шошго; focus үед тоологч («23/48»)
 *   · Enter / гадна дарах — дуусгах; Esc — засахын өмнөх утга руу буцаах
 *   · хоосон үед `fallback` (дэлгүүрт үнэхээр гарах өгөгдмөл) жинхэнэ өнгөөр,
 *     эсвэл `addLabel` («+ Тайлбар нэмэх») бүдгээр харагдана
 */
export function EditableText({
  value,
  onChange,
  label,
  maxLength,
  fallback,
  addLabel,
  invalid = false,
  disabled = false,
  block = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Шошгоны нэр («Гарчиг») — `aria-label` мөн. */
  label: string;
  maxLength: number;
  /** Хоосон үед дэлгүүрт гарах өгөгдмөл текст. */
  fallback?: string;
  /** Хоосон, өгөгдмөлгүй сонголтот талбарын бүдэг орлуулагч. */
  addLabel?: string;
  /** Заавал талбар хоосон г.м. — улаан хүрээ. */
  invalid?: boolean;
  disabled?: boolean;
  /** Бүтэн мөр эзлэх (тайлбар) — үгүй бол текстийнхээ өргөнтэй. */
  block?: boolean;
  className?: string;
}) {
  /** Засаж эхлэх мөчийн утга — Esc үүн рүү буцаана. */
  const before = React.useRef(value);
  const placeholder = fallback || addLabel || "";

  return (
    <span
      className={cn(
        "group/edit outline-cta relative min-w-[3ch] rounded-xs outline-offset-2",
        block ? "grid" : "inline-grid max-w-full",
        !disabled && "hover:outline-1 focus-within:outline-2",
        invalid && "outline-destructive outline-2",
        className,
      )}
    >
      {/* Толин — хэмжээг тогтооно. Төгсгөлийн зай нь хоосон мөрийг барина. */}
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 wrap-break-word whitespace-pre-wrap"
      >
        {value || placeholder}{" "}
      </span>
      <textarea
        rows={1}
        // Өгөгдмөл cols=20 нь grid нүдийг тэлнэ — өргөнийг толин л тогтооно.
        cols={1}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        spellCheck={false}
        onFocus={() => {
          before.current = value;
        }}
        onChange={(e) => onChange(sanitizeInline(e.target.value, maxLength))}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onChange(before.current);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "col-start-1 row-start-1 w-full min-w-0 resize-none overflow-hidden wrap-break-word outline-none [text-align:inherit] [text-transform:inherit] disabled:cursor-default",
          fallback
            ? "placeholder:text-current"
            : "placeholder:text-muted-foreground placeholder:font-normal",
        )}
      />
      {!disabled && (
        <>
          <span
            aria-hidden
            className="bg-cta text-cta-foreground pointer-events-none absolute -top-5 left-0 z-10 hidden rounded-xs px-1 font-sans text-[10px]/4 font-medium tracking-normal whitespace-nowrap normal-case group-focus-within/edit:block group-hover/edit:block"
          >
            {label}
          </span>
          <span
            aria-hidden
            className="bg-card text-muted-foreground pointer-events-none absolute right-0 -bottom-5 z-10 hidden rounded-xs px-1 font-sans text-[10px]/4 font-normal tracking-normal whitespace-nowrap tabular-nums group-focus-within/edit:block"
          >
            {value.length}/{maxLength}
          </span>
        </>
      )}
    </span>
  );
}
