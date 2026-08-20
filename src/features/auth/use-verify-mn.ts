"use client";

import * as React from "react";

/**
 * verify.mn MO-SMS баталгаажуулалтын клиент урсгал: сесс нээгээд (start),
 * 3 сек тутам төлөвийг шалгана — 2 сек-ээс хурдан шалгавал verify.mn 429
 * өгдөг тул үүнээс хурдан асуухгүй. Account-ын PhoneVerify болон auth
 * формууд хоёулаа үүнийг ашиглана.
 */

const POLL_MS = 3_000;

export type VerifyStage =
  | "idle"
  | "starting"
  | "waiting"
  | "verified"
  | "expired"
  | "error";

export interface VerifySession {
  sessionId: string;
  smsUri: string;
  displayInstruction: string;
  shortcode: string;
  expiresAt: string;
}

export function useVerifyMn(onVerified?: (sessionId: string) => void) {
  const [stage, setStage] = React.useState<VerifyStage>("idle");
  const [session, setSession] = React.useState<VerifySession | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const onVerifiedRef = React.useRef(onVerified);
  React.useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  const reset = React.useCallback(() => {
    setStage("idle");
    setSession(null);
    setError(null);
  }, []);

  const start = React.useCallback(
    async (phone: string, intent?: "register" | "reset") => {
      setStage("starting");
      setError(null);
      try {
        const res = await fetch("/api/auth/verify-mn/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, intent }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          const messages: Record<string, string> = {
            NOT_CONFIGURED: "Баталгаажуулалт одоогоор идэвхгүй байна.",
            ALREADY_REGISTERED:
              "Энэ дугаар аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.",
            NOT_REGISTERED:
              "Энэ дугаараар бүртгэл олдсонгүй. Эхлээд бүртгүүлнэ үү.",
          };
          setError(
            messages[body?.error ?? ""] ??
              "Сесс эхлүүлж чадсангүй. Дахин оролдоно уу.",
          );
          setStage("error");
          return;
        }
        const data = (await res.json()) as VerifySession;
        setSession(data);
        setSecondsLeft(
          Math.max(
            0,
            Math.round(
              (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
            ),
          ),
        );
        setStage("waiting");
      } catch {
        setError("Сүлжээний алдаа гарлаа. Дахин оролдоно уу.");
        setStage("error");
      }
    },
    [],
  );

  // Хүлээх горим: секунд тоолно + 3 сек тутам төлөв шалгана.
  React.useEffect(() => {
    if (stage !== "waiting" || !session) return;

    const tick = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1_000,
    );

    let stopped = false;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-mn/status?session=${encodeURIComponent(session.sessionId)}`,
        );
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { sessionStatus?: string };
        if (data.sessionStatus === "VERIFIED") {
          stopped = true;
          setStage("verified");
          onVerifiedRef.current?.(session.sessionId);
        } else if (data.sessionStatus === "EXPIRED") {
          stopped = true;
          setStage("expired");
        }
      } catch {
        // Түр зуурын сүлжээний алдаа — дараагийн шалгалт хүртэл тэвчинэ.
      }
    }, POLL_MS);

    const deadline = setTimeout(
      () => setStage("expired"),
      new Date(session.expiresAt).getTime() - Date.now(),
    );

    return () => {
      stopped = true;
      clearInterval(tick);
      clearInterval(poll);
      clearTimeout(deadline);
    };
  }, [stage, session]);

  return { stage, session, secondsLeft, error, start, reset };
}
