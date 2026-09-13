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
import { rateLimitMessage } from "@/lib/rate-limit-client";

export function ContactForm() {
  const [done, setDone] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactInputSchema),
  });

  async function onSubmit(values: ContactInput) {
    setServerError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setServerError(limited);
        return;
      }
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setServerError("Илгээхэд алдаа гарлаа. Дахин оролдоно уу.");
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
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="text-destructive text-xs">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Имэйл</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-destructive text-xs">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Мессеж</Label>
        <textarea
          id="message"
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
          className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
          {...register("message")}
        />
        {errors.message && (
          <p
            id="message-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.message.message}
          </p>
        )}
      </div>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Илгээж байна…" : "Илгээх"}
      </Button>
    </form>
  );
}
