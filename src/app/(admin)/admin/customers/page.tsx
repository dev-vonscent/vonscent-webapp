import Link from "next/link";
import { Users } from "lucide-react";
import { CUSTOMERS_PER_PAGE, getCustomers } from "@/features/admin/api";
import { CustomersTable } from "@/features/admin/components/customers-table";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import { CustomersToolbar } from "@/features/admin/components/customers-toolbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageIndex = Math.max(0, (Number(page) || 1) - 1);
  const { rows, total } = await getCustomers(q, pageIndex);
  const href = makeHrefBuilder("/admin/customers", { q });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Хэрэглэгч"
        count={total ?? undefined}
        actions={<CustomersToolbar />}
      />

      {rows.length === 0 ? (
        <EmptyState
          surface="card"
          icon={Users}
          title={q ? "Энэ хайлтад тохирох хэрэглэгч алга" : "Хэрэглэгч алга"}
          description={
            q
              ? "Өөр нэр эсвэл утасны дугаараар хайж үзнэ үү."
              : "Хэрэглэгч бүртгүүлмэгц энд харагдана."
          }
          action={
            q && (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/admin/customers">Бүх хэрэглэгч харах</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <CustomersTable data={rows} />
          {total !== null && (
            <ServerPager
              page={pageIndex}
              perPage={CUSTOMERS_PER_PAGE}
              total={total}
              hrefForPage={(i) =>
                href({ page: i > 0 ? String(i + 1) : undefined })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
