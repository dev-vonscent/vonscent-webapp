"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
        Алдаа гарлаа
      </p>
      <h1 className="font-serif text-3xl font-semibold">
        Түр зуурын саатал гарлаа
      </h1>
      <p className="text-muted-foreground max-w-md">
        Уучлаарай, хуудсыг ачаалах үед алдаа гарлаа. Дахин оролдоод үзээрэй —
        асуудал давтагдвал бид мэдээллийг хүлээн авсан байгаа.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Дахин оролдох</Button>
        <Button asChild variant="outline">
          <Link href="/">Нүүр хуудас</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">Код: {error.digest}</p>
      ) : null}
    </main>
  );
}
