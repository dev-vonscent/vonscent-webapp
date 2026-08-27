"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquareText, RotateCw } from "lucide-react";
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
    subtitle: "Утасны дугаар, нууц кодоо оруулна уу",
    cta: "Нэвтрэх",
  },
  register: {
    title: "Бүртгүүлэх",
    subtitle: "Утасны дугаараа баталгаажуулна",
    cta: "Бүртгүүлэх",
  },
  forgot: {
    title: "Нууц код сэргээх",
    subtitle: "Дугаараа дахин баталгаажуулж шинэ нууц код тохируулна",
    cta: "Нууц код солих",
  },
};

/** Бүртгэлийн 1·2·3 алхам заагч — хэрэглэгч хаана явж буйгаа мэднэ. */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {([1, 2, 3] as const).map((n) => (
        <React.Fragment key={n}>
          {n > 1 && (
            <span
              className={`h-px w-6 ${n <= step ? "bg-gold" : "bg-foreground/15"}`}
            />
          )}
          {n < step ? (
            <span className="text-gold flex size-6.5 items-center justify-center rounded-full border-[1.5px] border-current! text-[13px]">
              ✓
            </span>
          ) : n === step ? (
            <span className="bg-foreground text-background flex size-6.5 items-center justify-center rounded-full text-xs font-bold">
              {n}
            </span>
          ) : (
            <span className="text-muted-foreground border-foreground/15! flex size-6.5 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold">
              {n}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

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
          left?: number;
        } | null;
        // Алдааг toast-оор — форм дотор зай эзлэхгүй, layout shift үгүй.
        if (body?.error === "LOCKED") {
          toast.error(
            `Хэт олон буруу оролдлого. ${body.minutes ?? 15} минутын дараа дахин оролдоно уу.`,
          );
        } else if (body?.error === "WRONG_CREDENTIALS") {
          toast.error(
            `Дугаар эсвэл нууц код буруу байна.${
              body.left ? ` (${body.left} оролдлого үлдсэн)` : ""
            }`,
          );
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
      toast.error("Нууц код хоорондоо таарахгүй байна.");
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
        toast.error("Бүртгэлтэй дугаар байна. Нэвтэрнэ үү.");
      } else if (body?.error === "NOT_REGISTERED") {
        toast.error("Энэ дугаар бүртгэлгүй байна. Эхлээд бүртгүүлнэ үү.");
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

  const step =
    verify.stage === "verified" ? 3 : verify.stage === "waiting" ? 2 : 1;

  return (
    <div className="space-y-7">
      {mode === "register" && (
        <Reveal delay={0}>
          <StepIndicator step={step} />
        </Reveal>
      )}

      {/* СМС хүлээх / нууц код тохируулах дэлгэцүүд өөрийн агуулгаараа
          ойлгомжтой — том гарчгийг зөвхөн эхний алхамд харуулна. */}
      {(mode === "login" ||
        (verify.stage !== "waiting" && verify.stage !== "verified")) && (
        <Reveal delay={0} className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {copy.subtitle}
          </p>
        </Reveal>
      )}

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
                Нууц код
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
              label="Нууц код"
              onComplete={(code) => doLogin(code)}
            />
          </Reveal>

          <Reveal delay={180}>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl tracking-wide transition-transform active:scale-[0.98] in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
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
            <div className="bg-card flex items-center justify-center gap-2 rounded-2xl p-4">
              <p className="font-serif text-lg">
                {phone.replace(/^(\d{4})(\d{4})$/u, "$1 $2")}
              </p>
              <p className="text-success text-sm font-semibold">
                Баталгаажлаа ✓
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-widest uppercase">
                Шинэ нууц код
              </Label>
              <DigitInput
                length={4}
                mask
                value={passcode}
                onChange={setPasscode}
                label="Шинэ нууц код"
                autoFocus
                onComplete={() => passcode2Ref.current?.focus()}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs tracking-widest uppercase">
                Нууц код давтах
              </Label>
              <DigitInput
                ref={passcode2Ref}
                length={4}
                mask
                value={passcode2}
                onChange={setPasscode2}
                label="Нууц код давтах"
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl tracking-wide transition-transform active:scale-[0.98] in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
              disabled={loading || !validPasscode || passcode2.length !== 4}
            >
              {loading ? "Түр хүлээнэ үү…" : copy.cta}
            </Button>

            {/* Ил гарц — бүртгэлээ дуусгалгүй нэвтрэх рүү буцаж болно */}
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-10 w-full rounded-xl text-[13px] font-normal"
              onClick={() => {
                verify.reset();
                router.push("/login");
              }}
            >
              Болих — нэвтрэх рүү буцах
            </Button>
          </div>
        </form>
      ) : verify.stage === "waiting" && verify.session ? (
        /* Алхам 2 — СМС хүлээж байна */
        <div className="animate-fade-up space-y-4">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
            onClick={() => verify.reset()}
          >
            <ArrowLeft className="size-4" /> Дугаар солих
          </button>
          <div className="bg-card space-y-5 rounded-2xl p-6 text-center">
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs tracking-widest uppercase">
            <span className="relative flex size-2">
              <span className="bg-foreground absolute inline-flex size-full  animate-ping rounded-full opacity-60" />
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

          <Button
            asChild
            className="h-12 w-full rounded-xl tracking-wide transition-transform active:scale-[0.98] in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
          >
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

          {/* Гарцууд: таймер дуусахыг хүлээх шаардлагагүй */}
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="ring-foreground/15 h-11 flex-1 rounded-xl ring-1"
              onClick={() => {
                verify.reset();
                router.push("/login");
              }}
            >
              Болих
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ring-foreground/15 h-11 flex-1 rounded-xl ring-1"
              onClick={() =>
                verify.start(phone, mode === "register" ? "register" : "reset")
              }
            >
              <RotateCw className="size-4" /> Дахин илгээх
            </Button>
          </div>
          </div>
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
          </Reveal>
          <Reveal delay={mode === "register" ? 180 : 120}>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl tracking-wide transition-transform active:scale-[0.98] in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
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
              className="text-muted-foreground hover:text-gold-strong text-xs"
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

      {/* СМС хүлээх/нууц код алхамд өөрийн гарцууд бий — доод линк илүүц. */}
      {(mode === "login" ||
        (verify.stage !== "waiting" && verify.stage !== "verified")) && (
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
              {mode === "forgot" ? "Санаа орлоо?" : "Бүртгэлтэй юу?"}{" "}
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
      )}
    </div>
  );
}
