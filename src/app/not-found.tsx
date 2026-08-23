import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
        404
      </p>
      <h1 className="font-serif text-3xl font-semibold">Хуудас олдсонгүй</h1>
      <p className="text-muted-foreground max-w-md">
        Таны хайсан хуудас байхгүй, эсвэл өөр хаяг руу зөөгдсөн байна. Нүүр
        хуудаснаас үргэлжлүүлээрэй.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Нүүр хуудас</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/catalog">Каталог үзэх</Link>
        </Button>
      </div>
    </main>
  );
}
