"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { reviewInputSchema } from "@/lib/validators/review";
import { REVIEW_BODY_MAX } from "@/lib/constants";
import { rateLimitMessage } from "@/lib/rate-limit-client";

type Existing = { rating: number; body: string } | null;

/**
 * Star + comment form. Requires login; upserts the user's single review for
 * this product.
 *
 * Because the write is an upsert, a returning reviewer was silently
 * overwriting their own review from a blank 5-star form. The existing review
 * is loaded first, so editing is visible and deliberate.
 */
export function ReviewForm({
  productId,
  slug,
}: {
  productId: string;
  slug: string;
}) {
  const router = useRouter();
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [existing, setExisting] = React.useState<Existing>(null);
  const [rating, setRating] = React.useState(5);
  const [hover, setHover] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    if (!supabase) {
      setAuthed(false);
      return;
    }
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      const { data: mine } = await supabase
        .from("reviews")
        .select("rating, body")
        .eq("product_id", productId)
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!active || !mine) return;
      const row = mine as { rating: number; body: string | null };
      setExisting({ rating: row.rating, body: row.body ?? "" });
      setRating(row.rating);
      setBody(row.body ?? "");
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  // Reserve the form's rough height so the column doesn't jump once auth lands.
  if (authed === null) return <div className="bg-card/40 h-48 rounded-2xl" />;

  if (!authed) {
    return (
      <p className="border-border bg-card/40 text-muted-foreground rounded-2xl border px-4 py-6 text-center text-sm">
        Сэтгэгдэл үлдээхийн тулд{" "}
        <Link
          href={`/login?next=${encodeURIComponent(`/products/${slug}`)}`}
          className="text-gold-strong hover:underline"
        >
          нэвтэрнэ үү
        </Link>
        .
      </p>
    );
  }

  const dirty =
    !existing || existing.rating !== rating || existing.body !== body.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Same schema the API route enforces, so a bad payload never leaves here.
    const parsed = reviewInputSchema.safeParse({ productId, rating, body });
    if (!parsed.success) {
      setError(
        `Үнэлгээ 1–5 од, сэтгэгдэл ${REVIEW_BODY_MAX} тэмдэгтээс хэтрэхгүй байна.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setError(limited);
        return;
      }
      if (!res.ok) throw new Error();
      setExisting({ rating: parsed.data.rating, body: parsed.data.body });
      setBody(parsed.data.body);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Сэтгэгдэл хадгалахад алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-card/40 h-fit space-y-3 rounded-2xl border p-5"
    >
      <p className="text-sm font-medium">
        {existing ? "Үнэлгээгээ засах" : "Үнэлгээ өгөх"}
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setRating(n);
              setSaved(false);
            }}
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
      <div>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          rows={3}
          maxLength={REVIEW_BODY_MAX}
          placeholder="Богинохон сэтгэгдлээ үлдээгээрэй (заавал биш)…"
          className="bg-secondary w-full rounded-md px-3 py-2 text-base md:text-sm"
        />
        <p className="text-muted-foreground mt-1 text-right text-xs tabular-nums">
          {body.length}/{REVIEW_BODY_MAX}
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && !error && (
        <p className="text-muted-foreground text-sm">
          Хадгаллаа. Баярлалаа! Хүссэн үедээ дахин засаж болно.
        </p>
      )}
      <Button type="submit" disabled={submitting || !dirty}>
        {submitting
          ? "Илгээж байна…"
          : existing
            ? "Өөрчлөлтөө хадгалах"
            : "Сэтгэгдэл илгээх"}
      </Button>
      {existing && (
        <p className="text-muted-foreground text-xs">
          Нэг бүтээгдэхүүнд нэг сэтгэгдэл үлдээнэ.
        </p>
      )}
    </form>
  );
}
