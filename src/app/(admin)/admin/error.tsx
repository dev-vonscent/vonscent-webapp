"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Without this, a thrown Supabase error escaped to the root error boundary and
 * took the whole admin shell — sidebar, navigation, everything — with it. Here
 * the operator keeps the chrome and gets a way back.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="bg-card flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg p-8 text-center"
    >
      <AlertTriangle className="text-destructive size-10" />
      <div className="space-y-1">
        <h1 className="font-serif text-xl font-semibold">
          Энэ хуудсыг ачаалж чадсангүй
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Өгөгдөл татахад алдаа гарлаа. Дахин оролдоод үзнэ үү — давтагдвал
          алдааны кодыг хамт мэдэгдээрэй.
        </p>
      </div>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          Алдааны код: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Дахин оролдох</Button>
        <Button variant="secondary" asChild>
          <Link href="/admin">Хяналтын самбар руу</Link>
        </Button>
      </div>
    </div>
  );
}
