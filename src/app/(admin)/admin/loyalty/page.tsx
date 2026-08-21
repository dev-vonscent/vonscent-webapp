"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/browser";

export default function AdminLoyaltyPage() {
  const [earnPer, setEarnPer] = React.useState(100);
  const [earnPoints, setEarnPoints] = React.useState(1);
  const [redeemRate, setRedeemRate] = React.useState(1);
  const [lockHours, setLockHours] = React.useState(24);
  const [saved, setSaved] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoaded(true);
      return;
    }
    supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: Record<string, number> } | null)?.value;
        if (v) {
          setEarnPer(v.earnPer ?? 100);
          setEarnPoints(v.earnPoints ?? 1);
          setRedeemRate(v.redeemRate ?? 1);
          setLockHours(v.lockHours ?? 24);
        }
        setLoaded(true);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "loyalty",
        value: { earnPer, earnPoints, redeemRate, lockHours },
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return <div className="h-40" />;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">V point тохиргоо</h1>
      <Card>
        <CardContent className="space-y-5 p-6">
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Оноо авах нэгж (₮ тутамд)</Label>
                <Input
                  type="number"
                  value={earnPer}
                  onChange={(e) => setEarnPer(Number(e.target.value) || 1)}
                />
                <p className="text-muted-foreground text-xs">
                  Жишээ: 1000 → 1000₮ тутамд оноо хуримтлуулна.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Авах оноо</Label>
                <Input
                  type="number"
                  value={earnPoints}
                  onChange={(e) => setEarnPoints(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Оноо хөрвүүлэх ханш (1 оноо = X ₮)</Label>
                <Input
                  type="number"
                  value={redeemRate}
                  onChange={(e) => setRedeemRate(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Оноо түгжих хугацаа (цаг)</Label>
                <Input
                  type="number"
                  value={lockHours}
                  onChange={(e) => setLockHours(Number(e.target.value) || 0)}
                />
                <p className="text-muted-foreground text-xs">
                  Шинэ оноо энэ хугацаанд түгжээтэй байна — захиалга
                  «Хүргэгдсэн» болвол хугацаанаас өмнө ч нээгдэнэ. 0 бол шууд
                  зарцуулж болно.
                </p>
              </div>
            </div>
            <Button type="submit">
              {saved ? "Хадгалагдлаа ✓" : "Хадгалах"}
            </Button>
          </form>
          <p className="text-muted-foreground text-sm">
            Хэрэглэгчийн оноо удирдах нь{" "}
            <Link
              href="/admin/customers"
              className="text-gold-strong hover:underline"
            >
              Хэрэглэгч
            </Link>{" "}
            хэсэгт байна.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
