"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  contactInputSchema,
  type ContactInput,
} from "@/lib/validators/contact";

export function ContactForm() {
  const [done, setDone] = React.useState(false);
  const [serverError, setServerError] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactInputSchema),
  });

  async function onSubmit(values: ContactInput) {
    setServerError(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setServerError(true);
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
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="border-border space-y-4 rounded-lg border p-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Нэр</Label>
        <Input
          id="name"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Имэйл</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-destructive text-xs">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Мессеж</Label>
        <textarea
          id="message"
          rows={5}
          aria-invalid={Boolean(errors.message)}
          className="bg-secondary focus-visible:ring-ring flex w-full rounded-md px-3 py-2 text-base focus-visible:ring-2 focus-visible:outline-none md:text-sm"
          {...register("message")}
        />
        {errors.message && (
          <p className="text-destructive text-xs">{errors.message.message}</p>
        )}
      </div>
      {serverError && (
        <p className="text-destructive text-sm">
          Илгээхэд алдаа гарлаа. Дахин оролдоно уу.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Илгээж байна…" : "Илгээх"}
      </Button>
    </form>
  );
}
