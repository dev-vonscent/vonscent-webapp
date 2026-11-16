import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Танигдаагүй багцын slug.
 *
 * Багц идэвхгүй болох, нэр нь солигдох нь энгийн үзэгдэл тул энд ирсэн хүн
 * буруу зүйл хийгээгүй — сайтын ерөнхий 404 руу шидэхийн оронд шууд бусад
 * багц руу нь заана.
 */
export default function CollectionNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center md:px-8">
      <PackageOpen
        className="text-muted-foreground mx-auto size-12"
        strokeWidth={1.5}
      />
      <h1 className="mt-4 text-2xl font-semibold">Багц олдсонгүй</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Энэ багц зарагдахаа больсон эсвэл хаяг нь өөрчлөгдсөн байж магадгүй.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/collections">Бэлэн багцууд</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/catalog">Каталог үзэх</Link>
        </Button>
      </div>
    </div>
  );
}
