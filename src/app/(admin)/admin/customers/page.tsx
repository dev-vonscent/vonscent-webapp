import Link from "next/link";
import { Users } from "lucide-react";
import { CUSTOMERS_PER_PAGE, getCustomers } from "@/features/admin/api";
import { CustomersTable } from "@/features/admin/components/customers-table";
import {
  ServerPager,
  makeHrefBuilder,
} from "@/features/admin/components/server-pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Хэрэглэгч</h1>
        <form action="/admin/customers">
          <label htmlFor="customer-search" className="sr-only">
            Хэрэглэгчийг нэрээр хайх
          </label>
          <Input
            id="customer-search"
            name="q"
            defaultValue={q}
            placeholder="Нэрээр хайх"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card flex flex-col items-center gap-3 rounded-lg py-20 text-center">
          <Users className="text-muted-foreground size-10" />
          <p className="font-medium">
            {q ? "Энэ хайлтад тохирох хэрэглэгч алга" : "Хэрэглэгч алга"}
          </p>
          <p className="text-muted-foreground max-w-xs text-sm">
            {q
              ? "Өөр нэрээр хайж үзнэ үү."
              : "Хэрэглэгч бүртгүүлмэгц энд харагдана."}
          </p>
          {q && (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/customers">Бүх хэрэглэгч харах</Link>
            </Button>
          )}
        </div>
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
