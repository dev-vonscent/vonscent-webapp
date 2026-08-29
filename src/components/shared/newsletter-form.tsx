"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<
    "idle" | "loading" | "done" | "login" | "taken" | "error"
  >("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  if (state === "done") {
    return (
      <p className="text-muted-foreground text-sm">
        Баярлалаа! Захиалгын мэдэгдэл энэ хаяг руу очно.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex max-w-sm gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Имэйл хаяг"
          placeholder="имэйл хаяг"
          className="bg-card"
        />
        <Button type="submit" disabled={state === "loading"}>
          {state === "loading" ? "..." : "Бүртгэх"}
        </Button>
      </form>
      {state === "login" && (
        <p className="text-muted-foreground text-sm">
          Имэйл бүртгүүлэхийн тулд{" "}
          <Link href="/login" className="text-gold-strong underline">
            нэвтэрнэ үү
          </Link>
          .
        </p>
      )}
      {state === "taken" && (
        <p className="text-destructive text-sm">
          Энэ имэйл өөр бүртгэлд холбогдсон байна.
        </p>
      )}
      {state === "error" && (
        <p className="text-destructive text-sm">
          Алдаа гарлаа — дараа дахин оролдоно уу.
        </p>
      )}
    </div>
  );
}
