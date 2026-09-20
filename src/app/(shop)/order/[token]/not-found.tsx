import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Танигдаагүй захиалгын токен.
 *
 * Энд ирсэн хүн ихэвчлэн бүрэн хуулагдаагүй линк барьж байгаа тул сайтын
 * ерөнхий 404-ын оронд шууд хайх зам руу заана.
 */
export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center md:px-8">
      <SearchX
        className="text-muted-foreground mx-auto size-12"
        strokeWidth={1.5}
      />
      <h1 className="mt-4 text-2xl font-semibold">Захиалга олдсонгүй</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Линк бүрэн хуулагдаагүй байж магадгүй. Захиалгын дугаар, утсаараа
        хайгаад үзээрэй.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/order/find">Захиалга хайх</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/contact">Бидэнтэй холбогдох</Link>
        </Button>
      </div>
    </div>
  );
}
