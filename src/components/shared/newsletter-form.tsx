"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Хөлийн «Мэдээлэл авах» форм.
 *
 * Хоёр зүйлийг зориудаар барьж байна:
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
 *     зөвхөн дотор нь spinner нэмэгдэнэ. Өмнө нь «Бүртгэх» → «...» болж
 *     товч агшиж, доор нь мессеж гэнэт нэмэгдэж, хөл нь үсэрч байв.
 */
type State =
  | "idle"
  | "loading"
  | "done"
  | "login"
  | "taken"
  | "error"
  | "empty"
  | "invalid";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<State>("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const field = inputRef.current;
    if (!field) return;
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
      if (res.status === 401) {
        setState("login");
      } else if (res.status === 409) {
        setState("taken");
      } else if (res.ok) {
        setState("done");
        setEmail("");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} noValidate className="flex max-w-sm gap-2">
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
          className="bg-card"
        />
        <Button
          type="submit"
          disabled={state === "loading"}
          aria-busy={state === "loading"}
        >
          {state === "loading" && <Loader2 className="size-4 animate-spin" />}
          Бүртгэх
        </Button>
      </form>
      {/* Үргэлж зурагдана: агуулга нь солигдоход хөл нь үсрэхгүй. */}
      <p
        id="newsletter-msg"
        role="status"
        aria-live="polite"
        className={
          "min-h-5 text-sm " +
          (state === "empty" ||
          state === "invalid" ||
          state === "taken" ||
          state === "error"
            ? "text-destructive"
            : "text-muted-foreground")
        }
      >
        <Message state={state} />
      </p>
    </div>
  );
}

function Message({ state }: { state: State }) {
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
      return null;
  }
}
