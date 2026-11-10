"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { FieldError, fieldErrorProps } from "@/components/ui/form-field";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import { toast } from "@/lib/toast";
import { SignOutForm } from "@/features/account/components/sign-out-form";
import { GENERIC_ERROR, REDEEM_MESSAGES } from "../messages";

interface RedeemResponse {
  ok?: boolean;
  points?: number;
  error?: string;
  message?: string;
}

async function redeem(
  body: { token: string } | { code: string },
): Promise<{ points: number } | { error: string; code?: string }> {
  try {
    const res = await fetch("/api/gift-cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const limited = await rateLimitMessage(res);
    if (limited) return { error: limited };
    const data = (await res.json().catch(() => null)) as RedeemResponse | null;
    if (res.ok && data?.ok) return { points: data.points ?? 0 };
    return {
      code: data?.error,
      error:
        data?.message ??
        (data?.error ? REDEEM_MESSAGES[data.error] : undefined) ??
        GENERIC_ERROR,
    };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

/**
 * `/gift/[token]`-ийн гол товч (gift-cards-plan §2.3). Сайтыг мэдэхгүй хүнд
 * зориулсан тул НЭГ л үйлдэл: нэвтрээгүй бол нэвтрэх/бүртгүүлэх рүү (буцаад
 * энд), нэвтэрсэн бол «Бэлгээ авах» → оноо.
 */
export function GiftCardRedeemAction({
  token,
  amount,
  loggedIn,
  viewerName = null,
  viewerIsBuyer = false,
}: {
  token: string;
  amount: number;
  loggedIn: boolean;
  /** Нэвтэрсэн бүртгэлийн нэр — оноо хэний дансанд орохыг хэлнэ. */
  viewerName?: string | null;
  /** Худалдан авагч өөрөө нээсэн (холбоосоо шалгах гэж г.м.). */
  viewerIsBuyer?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [points, setPoints] = React.useState<number | null>(null);
  const next = encodeURIComponent(`/gift/${token}`);

  if (points !== null) {
    return (
      <div className="bg-secondary rounded-2xl p-6 text-center">
        <CheckCircle2
          className="text-success mx-auto size-10"
          aria-hidden="true"
        />
        <p className="mt-3 text-lg font-semibold">
          Таны дансанд {points.toLocaleString("mn-MN")} V point орлоо
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Үнэртэн сонгоод төлбөр төлөхдөө «V point ашиглах»-ыг сонгоорой.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link href="/catalog">Үнэртэн сонгох</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/quiz">Надад тохирох үнэрийг олох</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="space-y-3">
        <Button
          asChild
          className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 w-full rounded-xl text-base"
        >
          <Link href={`/register?next=${next}`}>Бэлгээ авах</Link>
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Бүртгэлтэй юу?{" "}
          <Link
            href={`/login?next=${next}`}
            className="text-foreground font-medium underline underline-offset-2"
          >
            Нэвтрэх
          </Link>
        </p>
      </div>
    );
  }

  async function onRedeem() {
    setPending(true);
    setError(null);
    const result = await redeem({ token });
    setPending(false);
    if ("points" in result) {
      setPoints(result.points);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {viewerIsBuyer && (
        <div
          role="note"
          className="bg-secondary flex gap-3 rounded-xl p-4 text-sm"
        >
          <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Энэ картыг <strong className="font-semibold">та</strong> худалдаж
            авсан. Бэлэглэх гэж байгаа бол доорх товчийг бүү дар — оноо таны
            дансанд орж, карт хүлээн авагчид ашиглагдахгүй болно.
          </p>
        </div>
      )}
      <LoadingButton
        loading={pending}
        onClick={onRedeem}
        className="bg-cta text-cta-foreground hover:bg-cta/90 h-12 w-full rounded-xl text-base"
      >
        {amount.toLocaleString("mn-MN")} V point-оо дансандаа нэмэх
      </LoadingButton>
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}
      <SignOutForm
        next={`/login?next=${next}`}
        className="text-muted-foreground text-center text-sm"
      >
        {viewerName ? (
          <>
            <strong className="text-foreground font-medium">{viewerName}</strong>{" "}
            бүртгэлд нэмэгдэнэ.{" "}
          </>
        ) : (
          "Таны нэвтэрсэн бүртгэлд нэмэгдэнэ. "
        )}
        <button
          type="submit"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Өөр бүртгэлээр авах
        </button>
      </SignOutForm>
    </div>
  );
}

/** Кодыг гараар оруулах (`/account/gift-cards`, «Урамшуулал»). */
export function GiftCardCodeForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Бэлгийн кодоо бичнэ үү.");
      return;
    }
    setPending(true);
    setError(undefined);
    const result = await redeem({ code });
    setPending(false);
    if ("points" in result) {
      setCode("");
      toast.success(
        `${result.points.toLocaleString("mn-MN")} V point таны дансанд орлоо.`,
        "Бэлэг хүлээн авлаа",
      );
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-1.5">
      <Label htmlFor="gift-code">Бэлгийн код</Label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VON-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          // Хэсэг нь өөрөө `bg-secondary` — талбар дэвсгэртэйгээ уусахгүй.
          className="bg-background font-mono tracking-wider"
          {...fieldErrorProps("gift-code", error)}
        />
        <LoadingButton type="submit" loading={pending} className="shrink-0">
          Оноо болгох
        </LoadingButton>
      </div>
      <FieldError id="gift-code" message={error} />
    </form>
  );
}
