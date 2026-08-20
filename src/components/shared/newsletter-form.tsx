"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setDone(true);
      setEmail("");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-muted-foreground text-sm">
        Баярлалаа! Таныг жагсаалтад нэмлээ.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm gap-2">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="имэйл хаяг"
        className="bg-card"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "..." : "Бүртгэх"}
      </Button>
    </form>
  );
}
