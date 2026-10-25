import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { SectionHeading } from "@/components/shared/section-heading";
import { Stars } from "@/components/shared/stars";
import { getRecentReviews } from "@/features/reviews/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { HOME_FEATURED_REVIEWS_MAX } from "@/lib/constants";
import { TierAvatar } from "@/features/tiers/components/tier-avatar";

/**
 * Real, published reviews only (`public_reviews`, non-empty text; with
 * `review_moderation` on, only the ones the admin picked). No
 * aggregate rating or customer count is shown — none is computed here, and
 * the section disappears when there is nothing to quote.
 */
export async function ReviewsSection() {
  // Туг `review_moderation` (0162): админы сонгосон (`is_featured`) сэтгэгдэл.
  const featuredOnly = await isFeatureEnabled("review_moderation");
  const reviews = (
    await getRecentReviews(featuredOnly ? HOME_FEATURED_REVIEWS_MAX : 3, {
      featuredOnly,
    })
  ).filter((r) => r.body?.trim());
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="home-reviews-title">
      <SectionHeading
        id="home-reviews-title"
        compact
        title="Худалдан авагчдын сэтгэгдэл"
      />
      <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
        {reviews.map((r) => (
          <li key={r.id}>
            <figure className="bg-card flex h-full flex-col gap-3 rounded-2xl p-4 sm:p-5">
              <Stars rating={r.rating} size={14} />
              <blockquote className="text-foreground/90 line-clamp-4 text-sm/relaxed">
                “{r.body}”
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3 pt-2">
                {r.authorTier ? (
                  <TierAvatar
                    tier={r.authorTier}
                    src={r.authorAvatar}
                    name={r.authorName}
                    size={32}
                  />
                ) : (
                  <span className="bg-secondary relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold">
                    {r.authorAvatar ? (
                      <Image
                        src={r.authorAvatar}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      r.authorName.charAt(0).toUpperCase()
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium">
                      {r.authorName}
                    </span>
                    <BadgeCheck
                      className="text-gold-strong size-3.5 shrink-0"
                      aria-label="Баталгаажсан худалдан авагч"
                    />
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {r.productName ? (
                      <Link
                        href={`/products/${r.productSlug}`}
                        className="hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {r.brand} {r.productName}
                      </Link>
                    ) : (
                      formatDate(r.createdAt)
                    )}
                  </span>
                </span>
                {r.productName && (
                  <Link
                    href={`/products/${r.productSlug}`}
                    className="group/prod shrink-0"
                    title={`${r.brand} ${r.productName}`}
                  >
                    <span className="border-border bg-muted group-hover/prod:border-gold-strong/50 relative block size-14 overflow-hidden rounded-lg border transition-colors">
                      {r.productImage ? (
                        <Image
                          src={r.productImage}
                          alt={r.productName}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground flex h-full items-center justify-center text-[10px] font-medium">
                          {r.brand.charAt(0)}
                        </span>
                      )}
                    </span>
                  </Link>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
