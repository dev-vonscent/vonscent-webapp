import Link from "next/link";
import { Instagram, Facebook, Mail } from "lucide-react";
import { Logo } from "./logo";
import { SITE } from "@/lib/constants";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  {
    title: "Дэлгүүр",
    links: [
      { href: "/catalog", label: "Бүх бараа" },
      { href: "/catalog?tags=new", label: "Шинэ" },
      { href: "/catalog?tags=hot", label: "Эрэлттэй" },
      { href: "/catalog?tags=sale", label: "Хямдрал" },
    ],
  },
  {
    title: "Тусламж",
    links: [
      { href: "/faq", label: "Түгээмэл асуулт" },
      { href: "/contact", label: "Холбоо барих" },
      { href: "/account/orders", label: "Захиалга хянах" },
    ],
  },
  {
    title: "Бидний тухай",
    links: [
      { href: "/about", label: "Танилцуулга" },
      { href: "/blog", label: "Блог" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface-deep mt-10 border-t sm:mt-20">
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo className="text-2xl" />
            <p className="text-muted-foreground max-w-xs text-sm">
              {SITE.description}
            </p>
            <div className="flex gap-2 pt-1">
              <Link
                href="#"
                aria-label="Instagram"
                className="border-border text-muted-foreground hover:border-gold-strong/50 hover:text-gold rounded-full border p-2.5 transition-colors"
              >
                <Instagram className="size-5" />
              </Link>
              <Link
                href="#"
                aria-label="Facebook"
                className="border-border text-muted-foreground hover:border-gold-strong/50 hover:text-gold rounded-full border p-2.5 transition-colors"
              >
                <Facebook className="size-5" />
              </Link>
              <Link
                href="/contact"
                aria-label="Имэйл"
                className="border-border text-muted-foreground hover:border-gold-strong/50 hover:text-gold rounded-full border p-2.5 transition-colors"
              >
                <Mail className="size-5" />
              </Link>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-gold mb-4 text-xs font-semibold tracking-[0.18em] uppercase">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 sm:mt-14">
          <div className="gold-rule" />
          <div className="mt-6 sm:mt-8">
            <h4 className="text-gold mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
              Мэдээлэл авах
            </h4>
            <NewsletterForm />
          </div>
        </div>

        <p className="text-muted-foreground/70 mt-8 text-xs sm:mt-12">
          © {new Date().getFullYear()} {SITE.name}. Бүх эрх хуулиар
          хамгаалагдсан.
        </p>
      </div>
    </footer>
  );
}
