"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Check, Info, Mail, UserRound } from "lucide-react";
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
import { GIFT_CARD_DRAFT_KEY, formatGiftAmount } from "../lib";
import type { GiftCardDesign } from "../types";
import { GiftCardFace } from "./gift-card-face";


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

const RULES = [
  "Кодыг төлбөр төлөгдсөнөөс хойш 1 жилийн дотор оноо болгох боломжтой. Оноо болсны дараа хугацаагүй.",
  "Бэлгийн картыг купон, V point-оор хямдруулах боломжгүй.",
  "Бэлгийн картыг буцаах боломжгүй.",
];

/**
 * Утсан дээр карт дээд талд наалттай тул focus авсан талбар түүний ард
 * нуугдахгүй: толгой + картын өндөр (өргөн × 756/1200, max-w-sm) + зай.
 */
const STICKY_SCROLL_MARGIN =
  "max-md:scroll-mt-[calc(var(--header-offset)+min(100vw-2rem,24rem)*0.63+1.5rem)]";

function StepLegend({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <legend className="flex items-center gap-2.5 text-base font-semibold">
      <span className="bg-secondary flex size-6 items-center justify-center rounded-full text-xs tabular-nums">
        {n}
      </span>
      {children}
    </legend>
  );
}

function readDraft(): (Partial<GiftCardPurchaseInput> & { savedId?: string }) | null {
  try {
    const raw = sessionStorage.getItem(GIFT_CARD_DRAFT_KEY);
    return raw
      ? (JSON.parse(raw) as Partial<GiftCardPurchaseInput> & { savedId?: string })
      : null;
  } catch {
    return null;
  }
}

function writeDraft(values: GiftCardPurchaseInput | null) {
  try {
    if (values) sessionStorage.setItem(GIFT_CARD_DRAFT_KEY, JSON.stringify(values));
    else sessionStorage.removeItem(GIFT_CARD_DRAFT_KEY);
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

  // «Дараа захиалах»-аас ирсэн бол захиалга үүсмэгц тэр мөрийг устгана.
  const [savedId, setSavedId] = React.useState<string | null>(null);

  // Нэвтрээд буцаж ирэхэд / «Дараа захиалах»-аас ноорог сэргэнэ.
  React.useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    const { savedId: fromSaved, ...values } = draft;
    setSavedId(fromSaved ?? null);
    // Хадгалснаас хойш идэвхгүй болсон загвар — сонголтгүй үлдэхгүй.
    if (values.designId && !designs.some((d) => d.id === values.designId)) {
      delete values.designId;
    }
    reset({ ...getValues(), ...values });
  }, [reset, getValues, designs]);

  // «Хэнээс» хоосон бол нэвтэрсэн хэрэглэгчийн нэрээр. «Б. Болд» → «Болд»
  // (овгийн үсгийг алгасна).
  React.useEffect(() => {
    if (profile?.name && !getValues("fromName")) {
      const parts = profile.name.trim().split(/\s+/u);
      setValue("fromName", parts.find((p) => !p.endsWith(".")) ?? profile.name);
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
        // Татгалзсан (validation, бизнес дүрэм) оролдлогын түлхүүрийг
        // шинэчилнэ — засаад илгээхэд шинэ захиалга. «Үүсч байна» (409
        // ORDER_PENDING) бол хуучин түлхүүрээр л дахин асууна.
        if (data?.error !== "ORDER_PENDING") renewRequestId();
        setServerError(
          data?.message ??
            (data?.error ? ORDER_MESSAGES[data.error] : undefined) ??
            GENERIC_ERROR,
        );
        return;
      }
      writeDraft(null);
      if (savedId) {
        void fetch(`/api/account/saved-checkouts/${savedId}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => undefined);
      }
      router.push(`/pay/${data.payToken}`);
    } catch {
      // Сүлжээ тасарсан — сервер захиалгыг үүсгэсэн байж магадгүй тул ИЖИЛ
      // түлхүүрээр дахин илгээхэд тэр захиалга буцна (давхар үүсэхгүй).
      setServerError(GENERIC_ERROR);
    }
  }

  if (!design) return null;
  const messageLength = values.message?.length ?? 0;
  const faceText = {
    amount: values.amount,
    recipientName: values.recipientName ?? "",
    message: values.message ?? "",
    fromName: values.fromName ?? "",
  };
  const pointsNote = (
    <p className="text-muted-foreground text-center text-xs">
      Хүлээн авагч кодоо оруулмагц{" "}
      <strong className="text-foreground font-medium">
        {values.amount.toLocaleString("mn-MN")} V point
      </strong>{" "}
      түүний дансанд орно (1 оноо = 1₮).
    </p>
  );

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Компьютер: баруун баганад наалттай. */}
      <div className="hidden md:order-2 md:block">
        <div className="space-y-3 md:sticky md:top-(--header-offset) md:transition-[top] md:duration-300 md:ease-out">
          <GiftCardFace design={design} priority text={faceText} />
          {pointsNote}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="min-w-0 space-y-10 md:order-1"
      >
        {/* Утас: загвар, дүн, мэндчилгээ бөглөх зуур карт дээд талд наалттай
            — бичсэн үг шууд картад гарахыг хардаг. Хүргэлтийн хэсэгт хүрэхэд
            энэ wrapper дуусаж карт өөрөө гүйж гарна. */}
        <div className="space-y-10">
          <div className="bg-background sticky top-(--header-offset) z-20 -mx-4 px-4 pt-1 pb-3 transition-[top] duration-300 ease-out md:hidden">
            <GiftCardFace
              design={design}
              priority
              text={faceText}
              className="mx-auto max-w-sm shadow-md"
            />
          </div>

          <fieldset className="min-w-0 space-y-3">
            <StepLegend n={1}>Загвар сонгох</StepLegend>
            <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-1 md:scroll-px-0 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {designs.map((d) => {
                const selected = d.id === values.designId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={(e) => {
                      setValue("designId", d.id);
                      // Утсан дээрх хэвтээ эгнээнд хагас харагдаж байсан бол.
                      e.currentTarget.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "nearest",
                      });
                    }}
                    className="group w-28 shrink-0 snap-start text-left outline-none md:w-auto"
                  >
                    <span className="relative block">
                      <GiftCardFace
                        design={d}
                        className="rounded-lg shadow-none group-focus-visible:ring-2 group-focus-visible:ring-ring"
                        text={{
                          amount: values.amount,
                          recipientName: "",
                          message: " ",
                          fromName: "",
                        }}
                      />
                      {/* Хүрээ биш: карт бүр өөр өнгөтэй тул хүрээ нь
                          зарим дээр уусаж, заримд хэт хүнд харагддаг.
                          Баруун доод булан нь картын хоосон бүс. */}
                      {selected && (
                        <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-black text-white shadow-md ring-2 ring-white md:size-6">
                          <Check className="size-3 md:size-3.5" strokeWidth={3} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 block px-0.5 text-xs",
                        selected
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground font-medium",
                      )}
                    >
                      <span className="truncate">{d.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <StepLegend n={2}>Дүн</StepLegend>
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
            <StepLegend n={3}>Мэндчилгээ</StepLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recipientName">Хэнд</Label>
                <Input
                  placeholder="Жишээ нь: Сараа"
                  autoComplete="off"
                  maxLength={GIFT_CARD_LIMITS.recipientName}
                  className={STICKY_SCROLL_MARGIN}
                  {...fieldErrorProps("recipientName", errors.recipientName?.message)}
                  {...register("recipientName")}
                />
                <FieldError
                  id="recipientName"
                  message={errors.recipientName?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fromName">Хэнээс</Label>
                <Input
                  placeholder="Таны нэр"
                  autoComplete="given-name"
                  maxLength={GIFT_CARD_LIMITS.fromName}
                  className={STICKY_SCROLL_MARGIN}
                  {...fieldErrorProps("fromName", errors.fromName?.message)}
                  {...register("fromName")}
                />
                <FieldError id="fromName" message={errors.fromName?.message} />
              </div>
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
                className={cn(
                  "bg-secondary field-edge flex w-full resize-none rounded-md px-3 py-2 text-base md:text-sm",
                  STICKY_SCROLL_MARGIN,
                )}
                {...fieldErrorProps("message", errors.message?.message)}
                {...register("message")}
              />
              <FieldError id="message" message={errors.message?.message} />
              {!values.message && design.defaultMessage && (
                <p className="text-muted-foreground text-xs">
                  Хоосон үлдээвэл картад санал болгосон мэндчилгээ гарна.
                </p>
              )}
            </div>
          </fieldset>
        </div>

        <fieldset className="space-y-3">
          <StepLegend n={4}>Хэрхэн өгөх вэ</StepLegend>
          <div className="space-y-2" role="radiogroup" aria-label="Хэрхэн өгөх вэ">
            {DELIVERY_OPTIONS.map((o) => {
              const selected = values.delivery === o.value;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue("delivery", o.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-secondary ring-cta ring-2"
                      : "bg-secondary/60 hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-cta text-cta-foreground" : "bg-background",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
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
            <div className="space-y-1.5 pt-1">
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
            <div className="space-y-1.5 pt-1">
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

        <div className="space-y-4">
          <div className="bg-secondary/60 rounded-xl p-4">
            <ul className="text-muted-foreground space-y-2 text-xs">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

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
              className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 w-full rounded-xl text-base"
            >
              {formatGiftAmount(values.amount)} — Төлбөр төлөх
            </LoadingButton>
            {!profileLoading && !profile && (
              <p className="text-muted-foreground text-center text-xs">
                Төлбөр төлөхийн өмнө утасны дугаараараа нэвтэрнэ. Бөглөсөн зүйл тань хадгалагдана.
              </p>
            )}
            <div className="md:hidden">{pointsNote}</div>
          </div>
        </div>
      </form>
    </div>
  );
}
