import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Unknown or stale pay token.
 *
 * A payment-specific boundary rather than the site's generic 404, because the
 * person who lands here is usually a customer holding a link that has aged out
 * — telling them "Хуудас олдсонгүй" leaves them with nowhere to go, while
 * their order history has the answer.
 *
 * Note the response is a 200 despite `notFound()`: this route has a
 * `loading.tsx`, so Next streams that shell (and its status line) before the
 * page's `await` resolves. The rendered page is what matters to the customer;
 * if the status code ever needs to be a real 404, the `loading.tsx` has to go.
 */
export default function PayNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center md:px-8">
      <SearchX
        className="text-muted-foreground mx-auto size-12"
        strokeWidth={1.5}
      />
      {/* `font-serif` нь `--font-sans` руу шийдэгддэг (DESIGN.md → One Family
          Rule) — харагдах өөрчлөлтгүй, зөвхөн зорилго үлдээж байв. */}
      <h1 className="mt-4 text-2xl font-semibold">Төлбөрийн линк олдсонгүй</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Линк хугацаа нь дууссан эсвэл бүрэн хуулагдаагүй байж магадгүй.
        Захиалгынхаа төлөвийг «Захиалгаа хянах» хэсгээс шалгаж, тэндээсээ
        төлбөрөө хийх боломжтой.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {/* `outline` нь хүрээгүй систем дээр `ghost`-той ялгарахгүй тул шинэ
            кодод хэрэглэхгүй (DESIGN.md → Components → Buttons). Хоёр гарцыг
            ялгах нь `secondary` vs `default`. */}
        <Button asChild variant="secondary">
          <Link href="/account/orders">Захиалгаа хянах</Link>
        </Button>
        <Button asChild>
          <Link href="/contact">Бидэнтэй холбогдох</Link>
        </Button>
      </div>
    </div>
  );
}
