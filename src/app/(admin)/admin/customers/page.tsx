import { Users } from "lucide-react";
import { getCustomers } from "@/features/admin/api";
import { CustomersTable } from "@/features/admin/components/customers-table";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await getCustomers(q);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">Хэрэглэгч</h1>
        <form action="/admin/customers">
          <input
            name="q"
            defaultValue={q}
            placeholder="Нэрээр хайх"
            className="border-border focus:border-primary h-9 rounded-md border bg-transparent px-3 text-sm outline-none"
          />
        </form>
      </div>

      {customers.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <Users className="text-muted-foreground size-10" />
          <p className="font-medium">Хэрэглэгч алга</p>
        </div>
      ) : (
        <CustomersTable data={customers} />
      )}
    </div>
  );
}
