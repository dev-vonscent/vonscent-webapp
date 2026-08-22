"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

/** Star + comment form. Requires login; upserts the user's review. */
export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [rating, setRating] = React.useState(5);
  const [hover, setHover] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setAuthed(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
  }, []);

  if (authed === null) return <div className="h-10" />;

  if (!authed) {
    return (
      <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
        Сэтгэгдэл үлдээхийн тулд{" "}
        <Link
          href={`/login?next=/products`}
          className="text-gold-strong hover:underline"
        >
          нэвтэрнэ үү
        </Link>
        .
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, body }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      setError("Сэтгэгдэл хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="bg-secondary rounded-lg px-4 py-6 text-center text-sm">
        Сэтгэгдэл хадгалагдлаа. Баярлалаа!
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-border space-y-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">Үнэлгээ өгөх</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} од`}
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                n <= (hover || rating)
                  ? "fill-gold text-gold"
                  : "text-muted-foreground/40 fill-transparent",
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Энэ үнэрийн талаар бодлоо хуваалцаарай (заавал биш)…"
        className="bg-secondary focus-visible:ring-ring w-full rounded-md px-3 py-2 text-base outline-none focus-visible:ring-2 md:text-sm"
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Илгээж байна…" : "Сэтгэгдэл илгээх"}
      </Button>
    </form>
  );
}
