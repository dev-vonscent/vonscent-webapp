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
    return (
      <div className="bg-secondary space-y-3 rounded-lg p-4 text-sm">
        <p>{session.displayInstruction}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm">
            <a href={session.smsUri}>
              <MessageSquareText className="size-4" /> СМС илгээх
            </a>
          </Button>
          <span className="text-muted-foreground">
            Хүлээж байна… {mm}:{ss}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          СМС-ийн төлбөр 150₮-ийг оператор таны дансаас суутгана.
        </p>
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
