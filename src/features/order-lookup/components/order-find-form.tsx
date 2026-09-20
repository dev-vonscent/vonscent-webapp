"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Захиалга хайх форм.
 *
 * Хоёр талбар зориуд: `order_no` нь дараалсан sequence тул ганцаараа хэн ч
 * бусдын захиалгыг татаж чадах оракул болно. Утас нь SMS илгээхгүй мэдлэгийн
 * хүчин зүйл — verify.mn-ийн дуудалт бүр төлбөртэй тул энд ашиглахгүй.
 *
 * Сервер бүх сөрөг үр дүнд ижил хариу буцаадаг; энэ форм ч мөн адил ганц
 * мессеж харуулна — «захиалга байхгүй» ба «утас буруу» хоёрыг ялгах нь
 * тандагчид л тус болно.
 */
export function OrderFindForm({ initialOrderNo }: { initialOrderNo?: string }) {
  const router = useRouter();
  const [orderNo, setOrderNo] = React.useState(initialOrderNo ?? "");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.message ??
            "Захиалга олдсонгүй. Дугаар, утсаа шалгаад дахин оролдоно уу.",
        );
        return;
      }
      router.push(`/order/${data.token}`);
    } catch {
      setError("Сүлжээнд холбогдож чадсангүй. Дахин оролдоно уу.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="order-no">Захиалгын дугаар</Label>
        <Input
          id="order-no"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="VS-1042"
          autoComplete="off"
          autoCapitalize="characters"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="order-phone">Захиалга өгөхдөө бичсэн утас</Label>
        <Input
          id="order-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="99112233"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Хайж байна…" : "Захиалга хайх"}
      </Button>
    </form>
  );
}
