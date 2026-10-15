import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import { PerfumeRequestsAdmin } from "@/features/perfume-requests/components/perfume-requests-admin";
import type { AdminPerfumeRequest } from "@/features/perfume-requests/types";
import type { PerfumeRequestRow } from "@/db/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Үнэртний санал" };

const PER_PAGE = 50;

/**
 * Админ → Каталог → Үнэртний санал (0137). Хамгийн олон хүн хүссэн нь
 * эхэнд — худалдан авалтын дараалал. Зөвхөн харах (клиент, 2026-10-15).
 */
export default async function AdminPerfumeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  // Туг хаалттай — шууд URL-ээр ч орохгүй (feature flag `perfume_requests`).
  if (!(await isFeatureEnabled("perfume_requests"))) notFound();

  const { q, page } = await searchParams;
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);

  let rows: AdminPerfumeRequest[] = [];
  let total: number | null = null;

  const supabase = await createClient();
  if (supabase) {
    let query = supabase
      .from("perfume_requests")
      .select("*", { count: "exact" })
      .order("vote_count", { ascending: false })
      .order("last_voted_at", { ascending: false })
      .range(pageIndex * PER_PAGE, pageIndex * PER_PAGE + PER_PAGE - 1);
    if (q) {
      const term = q.replace(/[%,()]/g, "").trim();
      if (term) {
        query = query.or(
          `brand_name.ilike.%${term}%,perfume_name.ilike.%${term}%`,
        );
      }
    }
    const { data, count } = await query;
    rows = ((data as PerfumeRequestRow[] | null) ?? []).map((r) => ({
      id: r.id,
      brand: r.brand_name,
      name: r.perfume_name,
      concentration: r.concentration,
      voteCount: r.vote_count,
      lastVotedAt: r.last_voted_at,
      createdAt: r.created_at,
    }));
    total = count ?? 0;
  }

  const hrefWith = makeHrefBuilder("/admin/requests", { q });
  const pageHref = (i: number) =>
    hrefWith({ page: i > 0 ? String(i + 1) : undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Үнэртний санал"
        description="Хэрэглэгчдийн хүссэн, манайд байхгүй үнэртнүүд — олон хүн хүссэн нь эхэнд."
        count={total ?? undefined}
      />

      <form
        action="/admin/requests"
        className="bg-card flex flex-wrap items-end gap-3 rounded-lg p-3"
      >
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Хайлт
          <Input
            name="q"
            defaultValue={q}
            placeholder="Брэнд / үнэртний нэр"
            className="w-56"
          />
        </label>
        <Button type="submit">Хайх</Button>
        {q && (
          <Button variant="ghost" asChild>
            <Link href="/admin/requests">Цэвэрлэх</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          surface="card"
          icon={MessageSquarePlus}
          title={q ? "Энэ хайлтад тохирох санал алга" : "Санал алга"}
          description={
            q
              ? "Өөр үгээр хайж эсвэл цэвэрлээд дахин үзнэ үү."
              : "Хэрэглэгч манайд байхгүй үнэртэн санал болгомогц энд харагдана."
          }
          action={
            q && (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/admin/requests">Бүх санал харах</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <PerfumeRequestsAdmin rows={rows} />
          {total !== null && (
            <ServerPager
              page={pageIndex}
              perPage={PER_PAGE}
              total={total}
              hrefForPage={pageHref}
            />
          )}
        </>
      )}
    </div>
  );
}
