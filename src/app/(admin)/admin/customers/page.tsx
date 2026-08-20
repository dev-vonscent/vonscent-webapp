import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCustomers } from "@/features/admin/api";
import { ROLE_LABEL } from "@/lib/constants";
import type { UserRole } from "@/db/types";

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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">Нэр</th>
                  <th className="px-4 py-3 font-medium">Утас</th>
                  <th className="px-4 py-3 font-medium">Эрх</th>
                  <th className="px-4 py-3 font-medium">V point</th>
                  <th className="px-4 py-3 font-medium">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border hover:bg-muted/30 border-t"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.full_name || "—"}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {ROLE_LABEL[c.role as UserRole]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{c.loyalty_points}</td>
                    <td className="px-4 py-3">
                      {c.is_blocked ? (
                        <Badge variant="sale">Хориглосон</Badge>
                      ) : (
                        <Badge variant="new">Идэвхтэй</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
