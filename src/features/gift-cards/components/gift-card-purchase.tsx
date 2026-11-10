"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Mail, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { FieldError, fieldErrorProps } from "@/components/ui/form-field";
import { DatePicker } from "@/features/admin/components/date-picker";
import { ubDayFromNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { GIFT_CARD_AMOUNTS, GIFT_CARD_LIMITS } from "@/lib/constants";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import { useProfileSummary } from "@/features/account/use-profile-summary";
import {
  GIFT_CARD_MAX_SCHEDULE_DAYS,
  GIFT_CARD_SEND_HOUR,
  giftCardPurchaseSchema,
  type GiftCardPurchaseInput,
} from "@/lib/validators/gift-card";
import { GENERIC_ERROR, ORDER_MESSAGES } from "../messages";
import { formatGiftAmount } from "../lib";
import type { GiftCardDesign } from "../types";
import { GiftCardFace } from "./gift-card-face";

/** Нэвтрэх рүү шилжихэд бөглөсөн талбарууд алга болохгүй (§12-Q1). */
const DRAFT_KEY = "vonscent:gift-card-draft";

const DELIVERY_OPTIONS = [
  {
    value: "email",
    icon: Mail,
    title: "Имэйлээр илгээх",
    description: "Төлбөр орсон даруйд код, заавар хүлээн авагч руу очно.",
  },
  {
    value: "scheduled",
    icon: CalendarClock,
    title: "Тодорхой өдөр илгээх",
    description: `Төрсөн өдөр, баярын өглөө ${GIFT_CARD_SEND_HOUR}:00 цагт хүлээн авагч руу очно.`,
  },
  {
    value: "self",
    icon: UserRound,
    title: "Өөрөө өгнө",
    description:
      "Карт таны бүртгэлд хадгалагдана — холбоосоор хуваалцах эсвэл дараа нь имэйлээр илгээнэ.",
  },
] as const;

function readDraft(): Partial<GiftCardPurchaseInput> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<GiftCardPurchaseInput>) : null;
  } catch {
    return null;
  }
}

function writeDraft(values: GiftCardPurchaseInput | null) {
  try {
    if (values) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Хувийн цонх — ноорог хадгалахгүй, урсгал зогсохгүй.
  }
}

/**
 * `/gift-cards` — загвар, дүн, мэндчилгээ, хүлээн авагч (gift-cards-plan §2.1).
 *
 * Сагсгүй (§12-Q2): «Төлбөр төлөх» нь шууд `/pay/<token>`. Зочин бүгдийг
 * харж бөглөнө; илгээх мөчид л нэвтрэлт шаардана.
 */
export function GiftCardPurchase({ designs }: { designs: GiftCardDesign[] }) {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfileSummary();
  const [serverError, setServerError] = React.useState<string | null>(null);
  // Идемпотентын түлхүүр: давхар дарахад нэг захиалга; алдааны дараа шинэ.
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID());
  const renewRequestId = () => setRequestId(crypto.randomUUID());

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<GiftCardPurchaseInput>({
    resolver: zodResolver(giftCardPurchaseSchema),
    defaultValues: {
      amount: GIFT_CARD_AMOUNTS[0],
      designId: designs[0]?.id ?? "classic",
      recipientName: "",
      message: "",
      fromName: "",
      delivery: "email",
      recipientEmail: "",
      sendDay: "",
    },
  });

  // Нэвтрээд буцаж ирэхэд ноорог сэргэнэ.
  React.useEffect(() => {
    const draft = readDraft();
    if (draft) reset({ ...getValues(), ...draft });
  }, [reset, getValues]);

  // «Хэнээс» хоосон бол нэвтэрсэн хэрэглэгчийн нэрээр.
  React.useEffect(() => {
    if (profile?.name && !getValues("fromName")) {
      setValue("fromName", profile.name.split(" ")[0] ?? profile.name);
    }
  }, [profile, getValues, setValue]);

  const [amount, designId, recipientName, message, fromName, delivery, sendDay] =
    useWatch({
      control,
      name: [
        "amount",
        "designId",
        "recipientName",
        "message",
        "fromName",
        "delivery",
        "sendDay",
      ],
    });
  const values = {
    amount,
    designId,
    recipientName,
    message,
    fromName,
    delivery,
  };
  const design =
    designs.find((d) => d.id === values.designId) ?? designs[0] ?? null;

  async function onSubmit(input: GiftCardPurchaseInput) {
    setServerError(null);
    if (!profile) {
      writeDraft(input);
      router.push(`/login?next=${encodeURIComponent("/gift-cards")}`);
      return;
    }
    try {
      const res = await fetch("/api/gift-cards/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, requestId }),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setServerError(limited);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        payToken?: string | null;
        error?: string;
        message?: string;
      } | null;
      if (res.status === 401) {
        writeDraft(input);
        router.push(`/login?next=${encodeURIComponent("/gift-cards")}`);
        return;
      }
      if (!res.ok || !data?.payToken) {
        // Алдаатай оролдлогын түлхүүрийг шинэчилнэ — засаад дахин илгээхэд
        // шинэ захиалга.
        renewRequestId();
        setServerError(
          data?.message ??
            (data?.error ? ORDER_MESSAGES[data.error] : undefined) ??
            GENERIC_ERROR,
        );
        return;
      }
      writeDraft(null);
      router.push(`/pay/${data.payToken}`);
    } catch {
      renewRequestId();
      setServerError(GENERIC_ERROR);
    }
  }

  if (!design) return null;
  const messageLength = values.message?.length ?? 0;

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
      {/* Утсан дээр preview эхэнд — юу бэлэглэж байгаагаа хардаг. */}
      <div className="md:order-2">
        <div className="md:sticky md:top-28">
          <GiftCardFace
            design={design}
            priority
            text={{
              amount: values.amount,
              recipientName: values.recipientName ?? "",
              message: values.message ?? "",
              fromName: values.fromName ?? "",
            }}
          />
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Хүлээн авагч кодоо оруулмагц{" "}
            <strong className="text-foreground font-medium">
              {values.amount.toLocaleString("mn-MN")} V point
            </strong>{" "}
            түүний дансанд орно (1 оноо = 1₮).
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-8 md:order-1"
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">1. Загвар</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {designs.map((d) => {
              const selected = d.id === values.designId;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("designId", d.id)}
                  className={cn(
                    "rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "ring-cta ring-2" : "hover:bg-secondary",
                  )}
                >
                  <GiftCardFace
                    design={d}
                    className="rounded-lg shadow-none"
                    text={{
                      amount: values.amount,
                      recipientName: "",
                      message: " ",
                      fromName: "",
                    }}
                  />
                  <span className="mt-1.5 block truncate px-1 text-xs font-medium">
                    {d.title}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">2. Дүн</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GIFT_CARD_AMOUNTS.map((amount) => {
              const selected = amount === values.amount;
              return (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("amount", amount)}
                  className={cn(
                    "h-12 rounded-xl text-sm font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-cta text-cta-foreground"
                      : "bg-secondary hover:bg-secondary/70",
                  )}
                >
                  {formatGiftAmount(amount)}
                </button>
              );
            })}
          </div>
          <FieldError id="amount" message={errors.amount?.message} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">3. Мэндчилгээ</legend>
          <div className="space-y-1.5">
            <Label htmlFor="recipientName">Хэнд</Label>
            <Input
              placeholder="Жишээ нь: Сараа"
              autoComplete="off"
              maxLength={GIFT_CARD_LIMITS.recipientName}
              {...fieldErrorProps("recipientName", errors.recipientName?.message)}
              {...register("recipientName")}
            />
            <FieldError
              id="recipientName"
              message={errors.recipientName?.message}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="message">Мэндчилгээ</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {messageLength}/{GIFT_CARD_LIMITS.message}
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={GIFT_CARD_LIMITS.message}
              placeholder={design.defaultMessage ?? "Хэдэн үгээр сэтгэлээ илэрхийлээрэй"}
              className="bg-secondary field-edge flex w-full resize-none rounded-md px-3 py-2 text-base md:text-sm"
              {...fieldErrorProps("message", errors.message?.message)}
              {...register("message")}
            />
            <FieldError id="message" message={errors.message?.message} />
            {!values.message && design.defaultMessage && (
              <p className="text-muted-foreground text-xs">
                Хоосон үлдээвэл картад дээрх санал болгосон мэндчилгээ гарна.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fromName">Хэнээс</Label>
            <Input
              placeholder="Таны нэр"
              autoComplete="given-name"
              maxLength={GIFT_CARD_LIMITS.fromName}
              {...fieldErrorProps("fromName", errors.fromName?.message)}
              {...register("fromName")}
            />
            <FieldError id="fromName" message={errors.fromName?.message} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">4. Хэрхэн өгөх вэ</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {DELIVERY_OPTIONS.map((o) => {
              const selected = values.delivery === o.value;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue("delivery", o.value)}
                  className={cn(
                    "flex gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-secondary ring-cta ring-2"
                      : "bg-secondary/60 hover:bg-secondary",
                  )}
                >
                  <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {o.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {delivery === "scheduled" && (
            <div className="space-y-1.5">
              <Label htmlFor="sendDay">Илгээх өдөр</Label>
              <DatePicker
                id="sendDay"
                value={sendDay ?? ""}
                onChange={(v) =>
                  setValue("sendDay", v, { shouldValidate: Boolean(errors.sendDay) })
                }
                min={ubDayFromNow(1)}
                max={ubDayFromNow(GIFT_CARD_MAX_SCHEDULE_DAYS)}
                placeholder="Өдөр сонгох"
                clearable={false}
                aria-invalid={Boolean(errors.sendDay)}
                aria-describedby={errors.sendDay ? "sendDay-error" : undefined}
              />
              <FieldError id="sendDay" message={errors.sendDay?.message} />
            </div>
          )}
          {values.delivery !== "self" && (
            <div className="space-y-1.5">
              <Label htmlFor="recipientEmail">Хүлээн авагчийн имэйл</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="saraa@gmail.com"
                {...fieldErrorProps(
                  "recipientEmail",
                  errors.recipientEmail?.message,
                )}
                {...register("recipientEmail")}
              />
              <FieldError
                id="recipientEmail"
                message={errors.recipientEmail?.message}
              />
            </div>
          )}
        </fieldset>

        <ul className="text-muted-foreground space-y-1.5 text-xs">
          <li>• Код төлбөр төлөгдсөнөөс хойш 1 жилийн дотор оноо болгоно. Оноо болсны дараа хугацаагүй.</li>
          <li>• Бэлгийн картыг купон, V point-оор хямдруулах боломжгүй.</li>
          <li>• Бэлгийн картыг буцаах боломжгүй.</li>
        </ul>

        {serverError && (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        )}

        <div className="space-y-2">
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            disabled={profileLoading}
            className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 w-full rounded-xl"
          >
            {formatGiftAmount(values.amount)} — Төлбөр төлөх
          </LoadingButton>
          {!profileLoading && !profile && (
            <p className="text-muted-foreground text-center text-xs">
              Төлбөр төлөхийн өмнө утасны дугаараараа нэвтэрнэ. Бөглөсөн зүйл тань хадгалагдана.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
