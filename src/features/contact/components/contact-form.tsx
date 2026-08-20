"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ContactForm() {
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          message: form.get("message"),
        }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="border-border flex items-center justify-center rounded-lg border p-8 text-center">
        <p className="text-sm">
          Баярлалаа! Таны мессежийг хүлээн авлаа. Удахгүй хариу өгье.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border space-y-4 rounded-lg border p-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Нэр</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Имэйл</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Мессеж</Label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="bg-secondary focus-visible:ring-ring flex w-full rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Илгээж байна…" : "Илгээх"}
      </Button>
    </form>
  );
}
