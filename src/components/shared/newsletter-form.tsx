"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { rateLimitMessage } from "@/lib/rate-limit-client";

/**
 * Хөлийн «Мэдээлэл авах» форм.
 *
 * Гурван зүйлийг зориудаар барьж байна:
 *
 *  1. **Браузарын бөмбөлөг гаргахгүй.** Өмнө нь `required` нь хоосон талбар
 *     дээр «Please fill out this field.» гэсэн англи бөмбөлөг гаргадаг байсан
 *     — сайтын бусад бүх алдаанаас өөр хэл, өөр загвартай. Одоо форм дээр
 *     `noValidate` бөгөөд `checkValidity()`-г өөрсдөө дуудна: имэйлийг
 *     браузарын нарийвчлалаар шалгасан хэвээр, харин мессежийг өөрсдөө
 *     монголоор, сайтын загвараар бичнэ.
 *
 *  2. **Байрлал үсрэхгүй.** Мессежийн мөр нь төлөвөөс үл хамааран үргэлж
 *     зурагдана (хоосон байсан ч өндрөө эзэлнэ), товчны бичиг солигдохгүй —
 *     зөвхөн дотор нь spinner нэмэгдэнэ. Мөрүүдийн өндөр ижил (h-10),
 *     талбар/хайрцгийн өргөн ч ижил (`max-w-66` + `w-28` товч) тул харах ↔
 *     засах горим солигдоход хөл үсрэхгүй, талбар агшихгүй.
 *
 *  3. **Бүртгэлтэй бол эхлээд ХАРУУЛНА, дараа нь засна.** Өмнө нь нэвтэрсэн,
 *     аль хэдийн бүртгүүлсэн хэрэглэгчид ч хоосон талбар харагддаг байсан тул
 *     юу бүртгэлтэйгээ мэдэхгүй, шинэ хаяг бичвэл хуучин нь чимээгүй
 *     солигддог байв. Одоо `GET /api/newsletter/me`-ээс уншаад хаягийг
 *     энгийн текстээр үзүүлж, «Солих» дарсан үед л талбар нээгдэж фокус
 *     авна (✓ / ✕ icon товчтой; хаяг өөрчлөгдөөгүй бол ✓ идэвхгүй — дэмий
 *     API дуудахгүй). Нэвтрээгүй үед сүлжээ огт хөдлөхгүй — эхлээд локал
 *     session-ийг шалгана.
 */
type State =
  | "idle"
  | "loading"
  | "done"
  | "login"
  | "taken"
  | "error"
  | "limited"
  | "empty"
  | "invalid";

/** Бүртгэлтэй хаяг — `null` бол бүртгэлгүй (эсвэл нэвтрээгүй). */
type Current = { email: string; isActive: boolean } | null;

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<State>("idle");
  const [current, setCurrent] = React.useState<Current>(null);
  const [editing, setEditing] = React.useState(false);
  /** «limited» төлөвийн мессеж — хэдэн минутын дараа гэдгийг сервер хэлнэ. */
  const [limitMsg, setLimitMsg] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let alive = true;

    async function refresh(signedIn: boolean) {
      if (!signedIn) {
        if (alive) setCurrent(null);
        return;
      }
      try {
        const res = await fetch("/api/newsletter/me");
        if (!alive) return;
        if (!res.ok) return setCurrent(null);
        const data = (await res.json()) as {
          email?: string | null;
          isActive?: boolean;
        };
        if (!alive) return;
        setCurrent(
          data.email
            ? { email: data.email, isActive: Boolean(data.isActive) }
            : null,
        );
      } catch {
        /* хөлийн туслах мэдээлэл — алдааг чимээгүй өнгөрөөнө */
      }
    }

    // Локал session — нэвтрээгүй зочны хувьд энэ нь сүлжээгүй шалгалт.
    supabase.auth
      .getSession()
      .then(({ data }) => refresh(Boolean(data.session)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      setEditing(false);
      setEmail("");
      setState("idle");
      void refresh(Boolean(session));
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  /** «Солих» дарсны дараа талбар нээгдмэгц фокус авна. */
  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setEmail(current?.email ?? "");
    setState("idle");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEmail("");
    setState("idle");
  }

  /** Засварласан хаяг хуучинтайгаа ижил — хадгалах зүйл алга. */
  const unchanged =
    editing && current !== null && email.trim().toLowerCase() === current.email;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const field = inputRef.current;
    if (!field) return;
    // Өөрчлөгдөөгүй бол API дуудахгүй — товч нь ч идэвхгүй байгаа.
    if (unchanged) return;
    // `noValidate` тул эдгээр нь бөмбөлөг гаргахгүй — зөвхөн үр дүнг нь авна.
    if (field.validity.valueMissing) {
      setState("empty");
      field.focus();
      return;
    }
    if (!field.checkValidity()) {
      setState("invalid");
      field.focus();
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setLimitMsg(
          (await rateLimitMessage(res)) ??
            "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.",
        );
        setState("limited");
      } else if (res.status === 401) {
        setState("login");
      } else if (res.status === 409) {
        setState("taken");
      } else if (res.ok) {
        setState("done");
        setCurrent({ email: email.trim().toLowerCase(), isActive: true });
        setEditing(false);
        setEmail("");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const showForm = !current || editing;

  return (
    <div className="space-y-2">
      {showForm ? (
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex max-w-sm flex-wrap gap-2"
        >
          <Input
            ref={inputRef}
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Засаж эхэлмэгц хуучин алдаа хамаагүй болно. Зөвхөн алдааны
              // төлвөөс буцаана — амжилтын мессежийг устгавал дахин анивчина.
              setState((s) =>
                s === "empty" || s === "invalid" || s === "error" ? "idle" : s,
              );
            }}
            aria-label="Имэйл хаяг"
            aria-invalid={state === "empty" || state === "invalid"}
            aria-describedby="newsletter-msg"
            placeholder="имэйл хаяг"
            className={
              // Засах горимд icon товч тул талбар мөрийн үлдсэн бүх өргөнийг
              // авна — утсан дээр урт имэйл багтана.
              editing
                ? "bg-card min-w-0 flex-1"
                : "bg-card w-full max-w-66 min-w-0 flex-1"
            }
          />
          {/* Засах горимд товчнууд icon болно: утсан дээр талбар нарийсаад
              урт имэйл багтахгүй болдог байв. */}
          <Button
            type="submit"
            disabled={state === "loading" || unchanged}
            aria-busy={state === "loading"}
            aria-label={editing ? "Хадгалах" : undefined}
            title={editing ? "Хадгалах" : undefined}
            size={editing ? "icon" : "default"}
            className={editing ? "shrink-0" : "w-28 shrink-0"}
          >
            {state === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : editing ? (
              <Check className="size-4" />
            ) : null}
            {!editing && "Бүртгэх"}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={cancelEdit}
              disabled={state === "loading"}
              aria-label="Болих"
              title="Болих"
              className="shrink-0"
            >
              <X className="size-4" />
            </Button>
          )}
        </form>
      ) : (
        <div className="flex max-w-sm flex-wrap gap-2">
          {/* Талбартай ижил хайрцаг: харах ↔ засах горим солигдоход хөл үсрэхгүй. */}
          <span className="bg-card field-edge flex h-10 w-full max-w-66 min-w-0 flex-1 items-center rounded-md px-3 text-base md:text-sm">
            <span className="truncate">{current.email}</span>
          </span>
          <Button
            type="button"
            variant="secondary"
            className="w-28 shrink-0"
            onClick={startEdit}
          >
            Солих
          </Button>
        </div>
      )}
      {/* Үргэлж зурагдана: агуулга нь солигдоход хөл нь үсрэхгүй. */}
      <div className="flex min-h-5 max-w-sm items-start gap-3">
        <p
          id="newsletter-msg"
          role="status"
          aria-live="polite"
          className={
            "flex-1 text-sm " +
            (state === "empty" ||
            state === "invalid" ||
            state === "taken" ||
            state === "limited" ||
            state === "error"
              ? "text-destructive"
              : "text-muted-foreground")
          }
        >
          <Message state={state} limitMsg={limitMsg} current={current} />
        </p>
      </div>
    </div>
  );
}

function Message({
  state,
  limitMsg,
  current,
}: {
  state: State;
  limitMsg: string;
  current: Current;
}) {
  if (state === "limited") return <>{limitMsg}</>;
  switch (state) {
    case "empty":
      return <>Имэйл хаягаа бичнэ үү.</>;
    case "invalid":
      return <>Имэйл хаяг буруу байна — жишээ нь name@example.com</>;
    case "done":
      return <>Баярлалаа! Захиалгын мэдэгдэл энэ хаяг руу очно.</>;
    case "taken":
      return <>Энэ имэйл өөр бүртгэлд холбогдсон байна.</>;
    case "error":
      return <>Алдаа гарлаа — дараа дахин оролдоно уу.</>;
    case "login":
      return (
        <>
          Имэйл бүртгүүлэхийн тулд{" "}
          <Link href="/login" className="text-gold-strong underline">
            нэвтэрнэ үү
          </Link>
          .
        </>
      );
    default:
      if (current && !current.isActive) {
        return (
          <>
            Мэдэгдэл унтраалттай —{" "}
            <Link href="/account" className="text-gold-strong underline">
              тохиргооноос
            </Link>{" "}
            асаана.
          </>
        );
      }
      return null;
  }
}
