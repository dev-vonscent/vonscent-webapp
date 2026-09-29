"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented digit input (OTP style). One invisible native input carries the
 * value — so the numeric keyboard, paste and autofill all work — while the
 * boxes only render it. The active box shows a blinking caret.
 */
export interface DigitInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Render dots instead of digits (passcode). */
  mask?: boolean;
  /** Insert a small gap after this many boxes (e.g. 4 for phone numbers). */
  groupAt?: number;
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (value: string) => void;
  className?: string;
  /** Нүдний хэмжээг дарж бичих (жишээ нь дөрвөлжин болгох). */
  cellClassName?: string;
}

export const DigitInput = React.forwardRef<HTMLInputElement, DigitInputProps>(
  (
    {
      length,
      value,
      onChange,
      mask = false,
      groupAt,
      label,
      autoFocus,
      disabled,
      onComplete,
      className,
      cellClassName,
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
    const [focused, setFocused] = React.useState(false);

    // `value` prop нь өмнөх render-ийнх — мобайл гар (IME, swipe, автобөглөлт)
    // нэг frame дотор хэд хэдэн change event илгээхэд тэр нь хоцорч, дуусахыг
    // буруу мэдэрдэг. Тиймээс өмнөх утгыг ref-д өөрсдөө хөтөлнө.
    const prevRef = React.useRef(value);
    React.useEffect(() => {
      prevRef.current = value;
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = e.target.value.replace(/\D/gu, "").slice(0, length);
      const prev = prevRef.current;
      prevRef.current = next;
      onChange(next);
      if (next.length === length && prev.length < length) {
        onComplete?.(next);
      }
    }

    /**
     * Сонголтыг үргэлж төгсгөлд нь нэг цэг болгож хураана.
     *
     * Нүднүүд зөвхөн дүрслэл — бичих, устгах нь ямагт төгсгөлд болно. Гэтэл
     * iOS үл харагдах input дотор ч текст сонгодог (удаан дарах, давхар
     * товших, устгахдаа): сонголтын бариул, томруулагч нь хуудасны давхарга
     * биш, системийн UI тул `opacity-0`-д нуугдахгүй, цэгүүдийн дээгүүр
     * зураас, хагархай дугуй болж харагддаг байв. Мөн дунд нь байрласан
     * курсор дараагийн оронг буруу байранд оруулна. `input-otp`-ийн адил.
     */
    function collapseToEnd(el: HTMLInputElement) {
      const end = el.value.length;
      if (el.selectionStart !== end || el.selectionEnd !== end) {
        el.setSelectionRange(end, end);
      }
    }

    const activeIndex = Math.min(value.length, length - 1);

    return (
      <div
        className={cn("relative", className)}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={handleChange}
          onSelect={(e) => collapseToEnd(e.currentTarget)}
          onFocus={(e) => {
            setFocused(true);
            collapseToEnd(e.currentTarget);
          }}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          disabled={disabled}
          // Системийн давхарга `opacity`-г үл тоосон ч текст, курсор,
          // сонголтын өнгө өөрөө тунгалаг; удаан дарахад callout цэс гарахгүй.
          className="absolute inset-0 z-10 cursor-pointer bg-transparent text-base text-transparent opacity-0 selection:bg-transparent [-webkit-text-fill-color:transparent] [-webkit-touch-callout:none]"
          style={{ caretColor: "transparent" }}
        />
        <div
          aria-hidden
          className="flex items-center justify-center gap-1.5"
        >
          {Array.from({ length }).map((_, i) => {
            const char = value[i];
            const active = focused && i === activeIndex && !disabled;
            return (
              <React.Fragment key={i}>
                {groupAt !== undefined && i === groupAt && (
                  <span className="bg-muted-foreground/40 h-px w-2 shrink-0 rounded-full" />
                )}
                {/* flat cells — the blinking caret alone marks the active one.
                    Цэг, курсор, орон нь DOM-оос хасагдахгүй — ямагт render
                    хийгдэж, opacity-оор л солигдоно; нүд бүр өөрийн давхаргатай
                    (`transform-gpu`). Нэвтрэх карт `backdrop-filter`-тэй тул
                    WebKit тэр дотроос хасагдсан элементийн байрыг дахин
                    зурдаггүй — устгасан нүдэнд хуучин цэг (курсор өнгөрсөн
                    1px багана нь л цэвэрлэгдэн) хагархай дугуй болж үлддэг байв. */}
                <div
                  className={cn(
                    "bg-secondary field-edge relative flex h-12 w-full max-w-10 min-w-0 flex-1 transform-gpu items-center justify-center rounded-xl text-lg font-semibold tabular-nums",
                    disabled && "opacity-50",
                    cellClassName,
                  )}
                >
                  {mask ? (
                    <span
                      className={cn(
                        "bg-foreground block size-2.5 rounded-full transition-[opacity,scale] duration-150",
                        char ? "scale-100 opacity-100" : "scale-50 opacity-0",
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        "transition-[opacity,scale] duration-150",
                        char ? "scale-100 opacity-100" : "scale-75 opacity-0",
                      )}
                    >
                      {char ?? "0"}
                    </span>
                  )}
                  <span
                    className={cn(
                      "bg-foreground absolute top-1/2 left-1/2 h-5 w-px -translate-1/2",
                      !char && active ? "animate-pulse" : "opacity-0",
                    )}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  },
);
DigitInput.displayName = "DigitInput";
