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
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
    const [focused, setFocused] = React.useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const next = e.target.value.replace(/\D/gu, "").slice(0, length);
      onChange(next);
      if (next.length === length && value.length < length) {
        onComplete?.(next);
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          disabled={disabled}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          style={{ caretColor: "transparent" }}
        />
        <div aria-hidden className="flex items-center justify-center gap-1.5">
          {Array.from({ length }).map((_, i) => {
            const char = value[i];
            const active = focused && i === activeIndex && !disabled;
            return (
              <React.Fragment key={i}>
                {groupAt !== undefined && i === groupAt && (
                  <span className="bg-muted-foreground/40 h-px w-2 shrink-0 rounded-full" />
                )}
                <div
                  className={cn(
                    "bg-secondary flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-semibold tabular-nums transition-all duration-150",
                    active && "ring-ring bg-accent scale-105 ring-2",
                    disabled && "opacity-50",
                  )}
                >
                  {char ? (
                    mask ? (
                      <span className="bg-foreground block size-2.5 rounded-full" />
                    ) : (
                      <span className="animate-in zoom-in-75 duration-150">
                        {char}
                      </span>
                    )
                  ) : active ? (
                    <span className="bg-foreground h-5 w-px animate-pulse" />
                  ) : null}
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
