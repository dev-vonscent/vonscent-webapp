import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import { ReviewsModerationAdmin } from "@/features/reviews/components/reviews-moderation-admin";
import { ReviewPointsSetting } from "@/features/reviews/components/review-points-setting";
import type { AdminReview } from "@/features/reviews/types";
import type { ReviewRejectReason, ReviewStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Сэтгэгдэл" };

const PER_PAGE = 30;

const TABS: { value: ReviewStatus | "featured"; label: string }[] = [
  { value: "pending", label: "Шалгах" },
  { value: "approved", label: "Батлагдсан" },
  { value: "featured", label: "Нүүрэнд" },
  { value: "rejected", label: "Цуцлагдсан" },
];
type Tab = (typeof TABS)[number]["value"];

interface Row {
  id: string;
  user_id: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  reject_reason: ReviewRejectReason | null;
  is_visible: boolean;
  is_featured: boolean;
  created_at: string;
  moderated_at: string | null;
  product: { name: string; brand: string; slug: string } | null;
  collection: { name: string; slug: string } | null;
}

/**
 * Админ → Маркетинг → Сэтгэгдэл (0162, туг `review_moderation`). Шалгах
 * дараалал нь хуучин нь эхэнд (24 цагийн дотор шалгах), бусад нь шинэ нь
 * эхэнд.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  if (!(await isFeatureEnabled("review_moderation"))) notFound();

  const { tab: tabParam, page } = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === tabParam)
    ? (tabParam as Tab)
    : "pending";
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);

  let rows: AdminReview[] = [];
  let total = 0;
  let pendingCount = 0;
  let loyalty: unknown = null;

  const supabase = await createClient();
  if (supabase) {
    let query = supabase
      .from("reviews")
      .select(
        "id, user_id, rating, body, status, reject_reason, is_visible, is_featured, created_at, moderated_at, product:products(name, brand, slug), collection:collections(name, slug)",
        { count: "exact" },
      )
      .order("created_at", { ascending: tab === "pending" })
      .range(pageIndex * PER_PAGE, pageIndex * PER_PAGE + PER_PAGE - 1);
    query =
      tab === "featured"
        ? query.eq("is_featured", true)
        : query.eq("status", tab);

    const [{ data, count }, { count: pending }, { data: loyaltyRow }] =
      await Promise.all([
        query,
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("settings")
          .select("value")
          .eq("key", "loyalty")
          .maybeSingle(),
      ]);
    total = count ?? 0;
    pendingCount = pending ?? 0;
    loyalty = (loyaltyRow as { value?: unknown } | null)?.value ?? null;

    const list = (data as unknown as Row[] | null) ?? [];
    // `reviews.user_id` нь auth.users руу заадаг тул profiles-ийг тусад нь.
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", ids)
      : { data: [] };
    const byId = new Map(
      (
        (profiles as
          | { id: string; full_name: string | null; phone: string | null }[]
          | null) ?? []
      ).map((p) => [p.id, p]),
    );

    rows = list.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body ?? "",
      status: r.status,
      rejectReason: r.reject_reason,
      isVisible: r.is_visible,
      isFeatured: r.is_featured,
      createdAt: r.created_at,
      moderatedAt: r.moderated_at,
      authorName: byId.get(r.user_id)?.full_name?.trim() || null,
      authorPhone: byId.get(r.user_id)?.phone ?? null,
      targetName: r.product
        ? `${r.product.brand} ${r.product.name}`
        : (r.collection?.name ?? "Устгагдсан"),
      targetHref: r.product
        ? `/products/${r.product.slug}`
        : r.collection
          ? `/collections/${r.collection.slug}`
          : null,
    }));
  }

  const hrefWith = makeHrefBuilder("/admin/reviews", {
    tab: tab === "pending" ? undefined : tab,
  });
  const pageHref = (i: number) =>
    hrefWith({ page: i > 0 ? String(i + 1) : undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сэтгэгдэл"
        description="Хэрэглэгчийн сэтгэгдлийг шалгаж батлах эсвэл цуцлах. Батлагдсан сэтгэгдэл барааны доор, «Нүүрэнд» сонгосон нь нүүр хуудсанд ч харагдана."
        count={total}
      />

      <ReviewPointsSetting loyalty={loyalty} />

      <nav
        aria-label="Сэтгэгдлийн төлөв"
        className="bg-secondary flex gap-1 overflow-x-auto rounded-xl p-1 text-sm"
      >
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={hrefWith({
              tab: t.value === "pending" ? undefined : t.value,
              page: undefined,
            })}
            aria-current={t.value === tab ? "page" : undefined}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-center font-medium whitespace-nowrap transition-colors",
              t.value === tab
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.value === "pending" && pendingCount > 0 && (
              <span className="ml-1 tabular-nums">({pendingCount})</span>
            )}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          surface="card"
          icon={MessageSquareText}
          title={tab === "pending" ? "Шалгах сэтгэгдэл алга" : "Сэтгэгдэл алга"}
          description={
            tab === "pending"
              ? "Хэрэглэгч сэтгэгдэл бичмэгц энд харагдана."
              : "Энэ төлөвт сэтгэгдэл байхгүй байна."
          }
        />
      ) : (
        <>
          <ReviewsModerationAdmin rows={rows} />
          <ServerPager
            page={pageIndex}
            perPage={PER_PAGE}
            total={total}
            hrefForPage={pageHref}
          />
        </>
      )}
    </div>
  );
}
