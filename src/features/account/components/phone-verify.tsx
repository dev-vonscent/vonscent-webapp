"use client";

import * as React from "react";
import { BadgeCheck, MessageSquareText, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useVerifyMn } from "@/features/auth/use-verify-mn";

/**
 * Account хуудасны утас баталгаажуулалт / солилт. Нэвтэрсэн хэрэглэгчийн
 * хувьд сервер тал баталгаажмагц profiles.phone + phone_verified-ыг (мөн
 * утас-passcode бүртгэлийн нэвтрэх имэйлийг) өөрөө шинэчилдэг.
 */
export function PhoneVerify({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified: () => void;
}) {
  const { stage, session, secondsLeft, error, start, reset } =
    useVerifyMn(onVerified);

  // Алдаа, хугацаа дуусахыг toast-оор мэдэгдэнэ.
  React.useEffect(() => {
    if (stage === "error" && error) toast.error(error);
    if (stage === "expired") {
      toast.error("Хугацаа дууслаа — СМС илгээгдээгүй байна.");
    }
  }, [stage, error]);

  const validPhone = /^\d{8}$/u.test(phone);

  // Дугаар солигдвол өмнөх сессээ орхино.
  React.useEffect(() => reset(), [phone, reset]);

  if (verified) return null;

  if (stage === "waiting" && session) {
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, "0");
    // Дугаар руу илгээх код — smsUri дотроос (sms:144773?body=XXXXXX).
    const smsCode = /body=(\d+)/u.exec(session.smsUri)?.[1] ?? "";
    return (
      <div className="bg-card space-y-5 rounded-2xl p-6 text-center">
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs tracking-widest uppercase">
          <span className="relative flex size-2">
            <span className="bg-foreground absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            <span className="bg-foreground relative inline-flex size-2 rounded-full" />
          </span>
          СМС хүлээж байна
        </div>

        {smsCode && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {session.shortcode} дугаарт илгээх код
            </p>
            <p className="font-serif text-4xl font-semibold tracking-[0.3em]">
              {smsCode}
            </p>
          </div>
        )}

        <p className="text-muted-foreground text-sm">
          {session.displayInstruction}
        </p>

        <Button
          asChild
          className="h-12 w-full rounded-xl tracking-wide transition-transform active:scale-[0.98] in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
        >
          <a href={session.smsUri}>
            <MessageSquareText className="size-4" /> СМС илгээх
          </a>
        </Button>

        <div className="space-y-2">
          <p className="text-muted-foreground text-sm tabular-nums">
            {mm}:{ss}
          </p>
          <div className="bg-secondary h-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${Math.min(100, (secondsLeft / 300) * 100)}%`,
              }}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          СМС-ийн төлбөр 150₮-ийг оператор таны дансаас суутгана.
        </p>

        {/* Гарцууд: таймер дуусахыг хүлээх шаардлагагүй */}
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="ring-foreground/15 h-11 flex-1 rounded-xl ring-1"
            onClick={reset}
          >
            Болих
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ring-foreground/15 h-11 flex-1 rounded-xl ring-1"
            onClick={() => start(phone, "register")}
          >
            <RotateCw className="size-4" /> Дахин илгээх
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!validPhone || stage === "starting"}
          onClick={() => start(phone, "register")}
        >
          {stage === "expired" ? (
            <>
              <RotateCw className="size-4" /> Дахин оролдох
            </>
          ) : (
            <>
              <BadgeCheck className="size-4" />
              {stage === "starting" ? "Түр хүлээнэ үү…" : "Баталгаажуулах"}
            </>
          )}
        </Button>
        {!validPhone && (
          <span className="text-muted-foreground text-xs">
            8 оронтой дугаар оруулаад баталгаажуулна уу.
          </span>
        )}
      </div>
    </div>
  );
}
