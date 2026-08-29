import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * `notFound()` from an admin page (a deleted order, a bad id in a pasted link)
 * used to fall through to the storefront's 404, dropping the operator out of
 * the admin shell entirely. This keeps the sidebar and offers a way back.
 */
export default function AdminNotFound() {
  return (
    <div className="bg-card flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg p-8 text-center">
      <SearchX className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="font-serif text-xl font-semibold">
          Ийм бичлэг олдсонгүй
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Хайж буй захиалга, бараа эсвэл хэрэглэгч устсан байж болно. Холбоосоо
          шалгаад дахин оролдоно уу.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/admin">Хяналтын самбар руу</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/admin/orders">Захиалгууд</Link>
        </Button>
      </div>
    </div>
  );
}
