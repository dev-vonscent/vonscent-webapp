"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquareText, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DigitInput } from "@/components/ui/digit-input";
import { createClient } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { useVerifyMn } from "@/features/auth/use-verify-mn";

type Mode = "login" | "register" | "forgot";

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  login: {
    title: "Нэвтрэх",
    subtitle: "Утасны дугаар, passcode-оо оруулна уу",
    cta: "Нэвтрэх",
  },
  register: {
    title: "Бүртгүүлэх",
    subtitle: "Утасны дугаараа баталгаажуулж бүртгүүлнэ",
    cta: "Бүртгүүлэх",
  },
  forgot: {
    title: "Passcode сэргээх",
    subtitle: "Дугаараа дахин баталгаажуулж шинэ passcode тохируулна",
    cta: "Passcode солих",
  },
};

/** Staggered entrance for the form blocks. */
function Reveal({
  delay,
  children,
  className,
}: {
  delay: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-fade-up ${className ?? ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Утас + 4 оронтой passcode-той нэвтрэлт (verify.mn MO-SMS дээр суурилсан).
 * register/forgot: дугаар баталгаажуулах → passcode тохируулах хоёр алхам.
 */
export function PhoneAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [phone, setPhone] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [passcode, setPasscode] = React.useState("");
  const [passcode2, setPasscode2] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const passcodeRef = React.useRef<HTMLInputElement>(null);
  const passcode2Ref = React.useRef<HTMLInputElement>(null);

  const verify = useVerifyMn();

  // Баталгаажуулалтын алдаа, хугацаа дуусахыг toast-оор мэдэгдэнэ.
  React.useEffect(() => {
    if (verify.stage === "error" && verify.error) toast.error(verify.error);
    if (verify.stage === "expired") {
      toast.error("Хугацаа дууслаа — СМС илгээгдээгүй байна.");
    }
  }, [verify.stage, verify.error]);

  const validPhone = /^\d{8}$/u.test(phone);
  const validPasscode = /^\d{4}$/u.test(passcode);

  const doLogin = React.useCallback(
    async (code?: string) => {
      const pc = code ?? passcode;
      if (loading || !/^\d{8}$/u.test(phone) || !/^\d{4}$/u.test(pc)) return;
      setLoading(true);
      try {
        const res = await fetch("/api/auth/phone/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, passcode: pc }),
        });
        if (res.ok) {
          router.push(next);
          router.refresh();
          return;
        }
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          minutes?: number;
        } | null;
        if (body?.error === "LOCKED") {
          toast.error(
            `Хэт олон буруу оролдлого. ${body.minutes ?? 15} минутын дараа дахин оролдоно уу.`,
          );
        } else if (body?.error === "WRONG_CREDENTIALS") {
          toast.error("Дугаар эсвэл passcode буруу байна.");
          setPasscode("");
        } else {
          toast.error("Нэвтэрч чадсангүй. Дахин оролдоно уу.");
        }
      } catch {
        toast.error("Сүлжээний алдаа гарлаа.");
      } finally {
        setLoading(false);
      }
    },
    [loading, phone, passcode, next, router],
  );

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    if (passcode !== passcode2) {
      toast.error("Passcode хоорондоо таарахгүй байна.");
      setPasscode2("");
      return;
    }
    if (!verify.session) return;
    setLoading(true);
    try {
      const res = await fetch(
        mode === "register"
          ? "/api/auth/phone/register"
          : "/api/auth/phone/reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: verify.session.sessionId,
            passcode,
            ...(mode === "register" ? { fullName } : {}),
          }),
        },
      );
      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (body?.error === "ALREADY_REGISTERED") {
        toast.error("Энэ дугаар аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.");
      } else if (body?.error === "NOT_REGISTERED") {
        toast.error("Энэ дугаараар бүртгэл олдсонгүй. Эхлээд бүртгүүлнэ үү.");
      } else if (body?.error === "NOT_VERIFIED") {
        toast.error(
          "Баталгаажуулалт хүчингүй боллоо. Дахин баталгаажуулна уу.",
        );
        verify.reset();
      } else {
        toast.error("Алдаа гарлаа. Дахин оролдоно уу.");
      }
    } catch {
      toast.error("Сүлжээний алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  // Имэйл нэвтрэлт — зөвхөн хөгжүүлэлтийн орчинд, тестийн бүртгэлд зориулав.
  const [devEmailOpen, setDevEmailOpen] = React.useState(false);
  const [devEmail, setDevEmail] = React.useState("");
  const [devPassword, setDevPassword] = React.useState("");
  // Нуусан — хэрэг гарвал доорх мөрийг сэргээгээд ашиглана:
  // mode === "login" && process.env.NODE_ENV === "development";
  const showDevEmail = false;

  async function devEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      toast.error("Нэвтрэлт одоогоор тохируулагдаагүй байна.");
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });
    setLoading(false);
    if (signInError) {
      toast.error("Имэйл эсвэл нууц үг буруу байна.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  const copy = COPY[mode];
  const mm = Math.floor(verify.secondsLeft / 60);
  const ss = String(verify.secondsLeft % 60).padStart(2, "0");
  // Дугаар руу илгээх код — smsUri дотроос (sms:144773?body=XXXXXX).
  const smsCode = verify.session
    ? (/body=(\d+)/u.exec(verify.session.smsUri)?.[1] ?? "")
    : "";

  return (
    <div className="space-y-7">
      <Reveal delay={0} className="text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{copy.subtitle}</p>
      </Reveal>

      {devEmailOpen ? null : mode === "login" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doLogin();
          }}
          className="space-y-6"
        >
          <Reveal delay={60} className="space-y-2">
            <Label className="text-muted-foreground text-xs tracking-widest uppercase">
              Утасны дугаар
            </Label>
            <DigitInput
              length={8}
              groupAt={4}
              value={phone}
              onChange={setPhone}
              label="Утасны дугаар"
              autoFocus
              onComplete={() => passcodeRef.current?.focus()}
            />
          </Reveal>

          <Reveal delay={120} className="space-y-2">
            <div className="flex items-end justify-between">
              <Label className="text-muted-foreground text-xs tracking-widest uppercase">
                Passcode
              </Label>
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Мартсан?
              </Link>
            </div>
            <DigitInput
              ref={passcodeRef}
              length={4}
              mask
              value={passcode}
              onChange={setPasscode}
              label="Passcode"
              onComplete={(code) => doLogin(code)}
            />
          </Reveal>

          <Reveal delay={180}>
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading || !validPhone || !validPasscode}
            >
              {loading ? "Түр хүлээнэ үү…" : copy.cta}
            </Button>
          </Reveal>
        </form>
      ) : verify.stage === "verified" ? (
        /* Алхам 2 — дугаар баталгаажсан, passcode тохируулна */
        <form onSubmit={submitPasscode} className="space-y-6">
          <div className="animate-fade-up space-y-6">
            <div className="bg-card space-y-1 rounded-2xl p-4 text-center">
              <p className="font-serif text-lg">{phone}</p>
              <p className="text-success text-sm">Дугаар баталгаажлаа ✓</p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-widest uppercase">
                Шинэ passcode
              </Label>
              <DigitInput
                length={4}
                mask
                value={passcode}
                onChange={setPasscode}
                label="Шинэ passcode"
                autoFocus
                onComplete={() => passcode2Ref.current?.focus()}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-widest uppercase">
                Passcode давтах
              </Label>
              <DigitInput
                ref={passcode2Ref}
                length={4}
                mask
                value={passcode2}
                onChange={setPasscode2}
                label="Passcode давтах"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading || !validPasscode || passcode2.length !== 4}
            >
              {loading ? "Түр хүлээнэ үү…" : copy.cta}
            </Button>
          </div>
        </form>
      ) : verify.stage === "waiting" && verify.session ? (
        /* Алхам 1.5 — СМС хүлээж байна */
        <div className="animate-fade-up bg-card space-y-5 rounded-2xl p-6 text-center">
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs tracking-widest uppercase">
            <span className="relative flex size-2">
              <span className="bg-foreground absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
              <span className="bg-foreground relative inline-flex size-2 rounded-full" />
            </span>
            СМС хүлээж байна
          </div>

          {smsCode && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">
                {verify.session.shortcode} дугаарт илгээх код
              </p>
              <p className="font-serif text-4xl font-semibold tracking-[0.3em]">
                {smsCode}
              </p>
            </div>
          )}

          <p className="text-muted-foreground text-sm">
            {verify.session.displayInstruction}
          </p>

          <Button asChild className="h-11 w-full">
            <a href={verify.session.smsUri}>
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
                  width: `${Math.min(100, (verify.secondsLeft / 300) * 100)}%`,
                }}
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            СМС-ийн төлбөр 150₮-ийг оператор таны дансаас суутгана.
          </p>
        </div>
      ) : (
        /* Алхам 1 — дугаараа өгч баталгаажуулалт эхлүүлнэ */
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify.start(phone, mode === "register" ? "register" : "reset");
          }}
          className="space-y-6"
        >
          {mode === "register" && (
            <Reveal delay={60} className="space-y-2">
              <Label
                htmlFor="name"
                className="text-muted-foreground text-xs tracking-widest uppercase"
              >
                Нэр
              </Label>
              <Input
                id="name"
                className="h-11"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Reveal>
          )}
          <Reveal delay={mode === "register" ? 120 : 60} className="space-y-2">
            <Label className="text-muted-foreground text-xs tracking-widest uppercase">
              Утасны дугаар
            </Label>
            <DigitInput
              length={8}
              groupAt={4}
              value={phone}
              onChange={setPhone}
              label="Утасны дугаар"
              autoFocus={mode === "forgot"}
            />
          </Reveal>{" "}
          {verify.stage === "error" && verify.error && (
            <p className="text-destructive-foreground bg-destructive/60 rounded-lg px-3 py-2 text-center text-sm">
              {verify.error}
            </p>
          )}
          <Reveal delay={mode === "register" ? 180 : 120}>
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={!validPhone || verify.stage === "starting"}
            >
              {verify.stage === "starting" ? (
                "Түр хүлээнэ үү…"
              ) : verify.stage === "expired" ? (
                <>
                  <RotateCw className="size-4" /> Дахин баталгаажуулах
                </>
              ) : (
                "Дугаар баталгаажуулах"
              )}
            </Button>
          </Reveal>
        </form>
      )}

      {showDevEmail && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <button
              type="button"
              className="text-muted-foreground hover:text-primary text-xs"
              onClick={() => setDevEmailOpen((v) => !v)}
            >
              {devEmailOpen
                ? "утасны дугаараар нэвтрэх"
                : "имэйлээр нэвтрэх (dev)"}
            </button>
            <Separator className="flex-1" />
          </div>

          {devEmailOpen && (
            <form onSubmit={devEmailLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-email">Имэйл</Label>
                <Input
                  id="dev-email"
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-password">Нууц үг</Label>
                <Input
                  id="dev-password"
                  type="password"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                {loading ? "..." : "Имэйлээр нэвтрэх"}
              </Button>
            </form>
          )}
        </>
      )}

      <Reveal delay={240}>
        <p className="text-muted-foreground text-center text-sm">
          {mode === "login" ? (
            <>
              Бүртгэлгүй юу?{" "}
              <Link
                href="/register"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Бүртгүүлэх
              </Link>
            </>
          ) : (
            <>
              Бүртгэлтэй юу?{" "}
              <Link
                href="/login"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Нэвтрэх
              </Link>
            </>
          )}
        </p>
      </Reveal>
    </div>
  );
}
