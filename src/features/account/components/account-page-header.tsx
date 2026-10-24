import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Дугуй «буцах» товч. Толгой бүхэлдээ тохирохгүй хуудсанд (дэлгэрэнгүй:
 * захиалга, купон) дангаар нь хэрэглэнэ — хэлбэр нь ижил хэвээр.
 */
export function AccountBackButton({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Буцах"
      className={cn(
        "bg-secondary text-foreground hover:bg-secondary/70 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
        className,
      )}
    >
      <ArrowLeft className="size-5" />
    </Link>
  );
}

/**
 * Дансны дэд хуудасны толгой: дугуй «буцах» товч + гарчиг + баруун талд
 * нэмэлт (тоо, үйлдэл). «Миний захиалга»-ын хэлбэр — хуудас бүр өөр өөрөөр
 * (текст линк, гарчиггүй, утсан дээр давхар гарчиг) байсныг нэгтгэв.
 *
 * Утсан дээр сайтын толгой өөрөө «← + гарчиг» харуулдаг (`site-header`
 * TITLES) тул буцах товч, гарчиг хоёр `md`-ээс дээш л харагдана. `aside` нь
 * үйлдэл байж болох тул утсан дээр ч үлдэнэ.
 */
export function AccountPageHeader({
  title,
  backHref = "/account",
  aside,
  className,
}: {
  title: string;
  backHref?: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "items-center gap-3",
        aside ? "flex" : "hidden md:flex",
        className,
      )}
    >
      <AccountBackButton href={backHref} className="hidden md:flex" />
      <h1 className="hidden font-serif text-2xl font-semibold md:block">
        {title}
      </h1>
      {aside && <div className="ml-auto flex items-center gap-3">{aside}</div>}
    </div>
  );
}
