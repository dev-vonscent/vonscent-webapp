import Link from "next/link";
import { Instagram, Facebook, Mail } from "lucide-react";
import { Logo } from "./logo";
import { SITE } from "@/lib/constants";
import { getSocialSettings } from "@/features/content/api";
import { NewsletterForm } from "./newsletter-form";
import { OrderTrackLink } from "./order-track-link";

const COLUMNS = [
  {
    title: "Дэлгүүр",
    links: [
      { href: "/catalog", label: "Бүх бараа" },
      { href: "/catalog?featured=1", label: "Онцлох" },
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
    ],
    // Нэвтэрсэн эсэхээс хамаарах тул баганын доор тусдаа зурагдана.
    trackOrder: true,
  },
];

export async function SiteFooter() {
  const social = await getSocialSettings();
  return (
    // Дээд margin байхгүй — нүүрний сүүлийн хэсэг өөрийн доод padding-тай тул
    // нэмэлт `mt` нь (dark-д footer хуудастай ижил хар) ~200px хоосон зай
    // болж байв. Утсан дээрх `pb-20` нь доод навигацын зай: footer-той
    // хуудсанд `<main>`-ээс энд шилждэг (layout.tsx).
    <footer className="bg-surface-deep pb-20 md:pb-0">
      <div className="mx-auto max-w-352 px-4 pt-8 pb-6 sm:pt-10 sm:pb-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo className="text-2xl" />
            <p className="text-muted-foreground max-w-xs text-sm">
              {SITE.description}
            </p>
            <div className="flex gap-2 pt-1">
              {social.instagram && (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="border-border text-muted-foreground hover:border-gold-strong/50 hover:text-gold rounded-full border p-2.5 transition-colors"
                >
                  <Instagram className="size-5" />
                </a>
              )}
              {social.facebook && (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="border-border text-muted-foreground hover:border-gold-strong/50 hover:text-gold rounded-full border p-2.5 transition-colors"
                >
                  <Facebook className="size-5" />
                </a>
              )}
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
              <h2 className="text-gold mb-4 text-xs font-semibold tracking-[0.18em] uppercase">
                {col.title}
              </h2>
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
                {col.trackOrder && (
                  <li>
                    <OrderTrackLink className="text-muted-foreground hover:text-foreground text-sm transition-colors" />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 sm:mt-14">
          <div className="gold-rule" />
          <div className="mt-6 sm:mt-8">
            <h2 className="text-gold mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
              Мэдээлэл авах
            </h2>
            <NewsletterForm />
          </div>
        </div>

        <p className="text-muted-foreground/70 mt-4 text-xs sm:mt-6">
          © {new Date().getFullYear()} {SITE.name}. Бүх эрх хуулиар
          хамгаалагдсан.
        </p>
      </div>
    </footer>
  );
}
