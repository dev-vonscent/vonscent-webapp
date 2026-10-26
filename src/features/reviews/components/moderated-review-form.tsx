"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Check,
  Clock,
  Lock,
  ShieldAlert,
  Star,
  XCircle,
} from "lucide-react";
import { LoadingButton } from "@/components/shared/loading-button";
import { cn } from "@/lib/utils";
import {
  countReviewChars,
  moderatedReviewInputSchema,
} from "@/lib/validators/review";
import {
  REVIEW_MODERATED_BODY_MAX,
  REVIEW_MODERATED_BODY_MIN,
  REVIEW_REJECT_REASON_LABEL,
} from "@/lib/constants";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import {
  targetParam,
  type OwnReview,
  type ReviewEligibility,
  type ReviewTarget,
} from "@/features/reviews/types";
import {
  reviewEligibilityKey,
  useReviewEligibility,
} from "@/features/reviews/use-review-eligibility";

const EXAMPLE =
  "Жишээ: Чихэрлэг дулаахан мэдрэмж төрүүлэхээр, өвөл юм уу орой сэрүүхэн үед түрхэхэд тохиромжтой санагдсан, 27 настай миний үеийн хүмүүст бол таалагдахаар үнэртэн…";

/** Одны тайлбар — 1..5. */
const RATING_LABEL = [
  "Огт таалагдаагүй",
  "Төдийлөн таалагдаагүй",
  "Дунд зэрэг",
  "Таалагдсан",
  "Маш их таалагдсан",
] as const;

/** Серверийн алдааны код → хэрэглэгчийн текст. */
const SUBMIT_ERROR: Record<string, string> = {
  too_short: `Сэтгэгдэл ${REVIEW_MODERATED_BODY_MIN} тэмдэгтэд хүрээгүй тул хадгалагдсангүй.`,
  already_reviewed: "Та энэ бараанд аль хэдийн сэтгэгдэл бичсэн байна.",
  profile_incomplete: "Бүртгэлээ бүрэн бөглөсний дараа сэтгэгдэл бичнэ үү.",
  not_purchased: "Худалдаж авсан бараандаа л сэтгэгдэл бичих боломжтой.",
  bought_in_bundle:
    "Энэ усыг багцаар авсан тул багцын хуудсанд сэтгэгдэл бичнэ үү.",
};

function formatPoints(points: number) {
  return `${points.toLocaleString("mn-MN")} V point`;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card/40 text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
      {children}
    </div>
  );
}

/** Бичсэн сэтгэгдлийн төлөв — засах, устгах боломжгүй (0162). */
function OwnStatus({ own, points }: { own: OwnReview; points: number }) {
  if (own.status === "pending") {
    return (
      <div className="border-border bg-card/40 space-y-2 rounded-2xl border p-5 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Clock className="text-gold-strong size-4" />
          Сэтгэгдлээ хуваалцсан танд баярлалаа!
        </p>
        <p className="text-muted-foreground">
          {points > 0
            ? `Таны сэтгэгдэл шалгагдаж дууссаад 24 цагийн дотор бүртгэлд тань ${formatPoints(points)} нэмэгдэх болно.`
            : "Таны сэтгэгдэл шалгагдаж дууссаны дараа нийтлэгдэнэ."}
        </p>
      </div>
    );
  }
  // Батлагдсан сэтгэгдэл жагсаалтад өөрөө харагдана — байнгын карт хэрэггүй.
  if (own.status === "approved") return null;
  return (
    <div className="border-border bg-card/40 space-y-1 rounded-2xl border p-5 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <XCircle className="text-destructive size-4" />
        Таны сэтгэгдэл цуцлагдсан
      </p>
      {own.rejectReason && (
        <p className="text-muted-foreground">
          Шалтгаан: {REVIEW_REJECT_REASON_LABEL[own.rejectReason]}
        </p>
      )}
    </div>
  );
}

/**
 * Хяналттай сэтгэгдлийн форм (туг `review_moderation`, 0162). Нэг удаа
 * бичигдэж, админ батласны дараа нийтлэгдэнэ; оноо батлах үед олгогдоно.
 * Нөхцөлийг (бүртгэл, худалдан авалт) сервер шийднэ — энд зөвхөн харуулна.
 */
export function ModeratedReviewForm({
  target,
  path,
}: {
  target: ReviewTarget;
  /** Нэвтрээд буцах хуудас. */
  path: string;
}) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useReviewEligibility(target);
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bodyId = React.useId();

  if (isPending) return <div className="bg-card/40 h-72 rounded-2xl" />;
  if (isError || !data) {
    return <Notice>Сэтгэгдлийн хэсгийг ачаалж чадсангүй.</Notice>;
  }
  if (data.own) return <OwnStatus own={data.own} points={data.points} />;

  switch (data.reason) {
    case "unauthorized":
      return (
        <Notice>
          Сэтгэгдэл үлдээхийн тулд{" "}
          <Link
            href={`/login?next=${encodeURIComponent(path)}`}
            className="text-gold-strong hover:underline"
          >
            нэвтэрнэ үү
          </Link>
          .
        </Notice>
      );
    case "profile_incomplete":
      return (
        <Notice>
          Сэтгэгдэл бичихийн тулд{" "}
          <Link href="/account" className="text-gold-strong hover:underline">
            бүртгэлээ бүрэн бөглөнө үү
          </Link>{" "}
          (нэр, баталгаажсан утасны дугаар).
        </Notice>
      );
    case "not_purchased":
      return (
        <Notice>
          Худалдаж авч, хүлээн авсан бараандаа сэтгэгдэл бичих боломжтой.
          {data.points > 0 &&
            ` Сэтгэгдэл бүрт ${formatPoints(data.points)} цуглуулаарай.`}
        </Notice>
      );
    case "bought_in_bundle":
      return (
        <Notice>
          Энэ усыг багцаар авсан тул сэтгэгдлээ{" "}
          <Link
            href="/account/orders"
            className="text-gold-strong hover:underline"
          >
            захиалсан багцынхаа
          </Link>{" "}
          хуудсанд бичнэ үү.
        </Notice>
      );
    case "already_reviewed":
      return <Notice>Та энэ бараанд аль хэдийн сэтгэгдэл бичсэн байна.</Notice>;
  }

  const chars = countReviewChars(body);
  const enough = chars >= REVIEW_MODERATED_BODY_MIN;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = moderatedReviewInputSchema.safeParse({
      ...targetParam(target),
      rating,
      body,
    });
    if (!parsed.success) {
      setError(
        rating === 0
          ? "Хэр таалагдсаныг одоор үнэлнэ үү."
          : SUBMIT_ERROR.too_short,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setError(limited);
        return;
      }
      if (!res.ok) {
        const code = (
          (await res.json().catch(() => null)) as {
            error?: string;
          } | null
        )?.error;
        setError(
          (code && SUBMIT_ERROR[code]) ?? "Сэтгэгдэл хадгалахад алдаа гарлаа.",
        );
        return;
      }
      queryClient.setQueryData<ReviewEligibility>(
        reviewEligibilityKey(target),
        (prev) =>
          prev && {
            ...prev,
            own: {
              rating: parsed.data.rating,
              body: parsed.data.body,
              status: "pending",
              rejectReason: null,
            },
          },
      );
    } catch {
      setError("Сэтгэгдэл хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = Math.min(chars / REVIEW_MODERATED_BODY_MIN, 1);
  const shown = hover || rating;

  return (
    <form
      onSubmit={submit}
      className="border-border bg-card/40 h-fit space-y-6 rounded-2xl border p-5 sm:p-6"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Сэтгэгдэл бичих</h3>
          {data.points > 0 && (
            <span className="bg-secondary text-gold-strong inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums">
              <Award className="size-4" />+{formatPoints(data.points)}
            </span>
          )}
        </div>
        {data.points > 0 && (
          <p className="text-muted-foreground text-sm">
            Сэтгэгдэл бичээд {formatPoints(data.points)} цуглуулаарай. Шалгагдаж
            батлагдсанаас хойш 24 цагийн дотор бүртгэлд тань нэмэгдэнэ.
          </p>
        )}
      </header>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Танд хэр таалагдсан бэ?
        </legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n} од — ${RATING_LABEL[n - 1]}`}
                aria-pressed={rating === n}
                className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:scale-110"
              >
                <Star
                  className={cn(
                    "size-8 transition-colors",
                    n <= shown
                      ? "fill-rating text-rating"
                      : "text-muted-foreground/50 fill-transparent",
                  )}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <span
            className={cn(
              "text-sm",
              shown ? "text-foreground" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {shown ? RATING_LABEL[shown - 1] : "Од дээр дарж үнэлнэ үү"}
          </span>
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor={bodyId} className="text-sm font-medium">
          Сэтгэгдэл
        </label>
        <textarea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={REVIEW_MODERATED_BODY_MAX}
          placeholder={EXAMPLE}
          aria-describedby={`${bodyId}-hint`}
          className="bg-secondary placeholder:text-muted-foreground/70 w-full resize-y rounded-xl px-4 py-3 text-base/relaxed md:text-sm/relaxed"
        />
        <div
          className="bg-secondary h-1 overflow-hidden rounded-full"
          aria-hidden
        >
          <div
            className="bg-gold-strong h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div
          id={`${bodyId}-hint`}
          className="flex items-center justify-between gap-3 text-xs"
        >
          {enough ? (
            <span className="text-foreground flex items-center gap-1">
              <Check className="size-3.5" />
              Хангалттай урттай
            </span>
          ) : (
            <span className="text-muted-foreground">
              Зай тооцохгүйгээр {REVIEW_MODERATED_BODY_MIN} тэмдэгтэд хүрээгүй
              бол хадгалагдахгүй
            </span>
          )}
          <span
            className={cn(
              "shrink-0 tabular-nums",
              enough ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {chars}/{REVIEW_MODERATED_BODY_MIN}
          </span>
        </div>
      </div>

      <ul className="text-muted-foreground space-y-2 text-xs/relaxed">
        <li className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          Ёс бус үг хэллэг ашигласан болон илт худал мэдээлэл оруулсан
          тохиолдолд таны сэтгэгдлийг хүчингүйд тооцож, V point олгохгүй байх
          боломжтой.
        </li>
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Хадгалсны дараа сэтгэгдлээ устгах болон засах боломжгүйг анхаарна уу.
        </li>
      </ul>

      <div className="space-y-2">
        {error && <p className="text-destructive text-sm">{error}</p>}
        <LoadingButton
          loading={submitting}
          type="submit"
          size="lg"
          disabled={!enough || rating === 0}
          className="w-full"
        >
          Сэтгэгдэл хадгалах
        </LoadingButton>
        {(!enough || rating === 0) && (
          <p className="text-muted-foreground text-center text-xs">
            {rating === 0 && !enough
              ? "Од сонгож, сэтгэгдлээ бичсэний дараа хадгална."
              : rating === 0
                ? "Од сонгосны дараа хадгална."
                : `${REVIEW_MODERATED_BODY_MIN - chars} тэмдэгт дутуу байна.`}
          </p>
        )}
      </div>
    </form>
  );
}
