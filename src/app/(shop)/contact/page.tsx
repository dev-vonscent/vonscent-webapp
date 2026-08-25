import type { Metadata } from "next";
import { Phone, Mail, MapPin, Instagram, Facebook, Clock } from "lucide-react";
import { ContactForm } from "@/features/contact/components/contact-form";
import { getSocialSettings, getStoreSettings } from "@/features/content/api";
import { DISPATCH_HOUR } from "@/lib/time";

/**
 * ISR: public data comes from the cookie-less client, so the page is
 * cacheable. Admin writes purge it via revalidatePublic(); this window
 * is just the safety net for writes that bypass the admin API.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Холбоо барих",
  description: "Бидэнтэй холбогдоорой — утас, имэйл, сошиал, мессеж.",
};

/** "https://www.instagram.com/von_scent/?x=1" → "von_scent" */
function handleFromUrl(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop()?.split("?")[0] ?? url;
}

export default async function ContactPage() {
  // Contact details come from admin Settings (Тохиргоо → Дэлгүүр / Сошиал) —
  // nothing here is hardcoded any more.
  const [store, social] = await Promise.all([
    getStoreSettings(),
    getSocialSettings(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Холбоо барих
      </h1>
      <p className="text-muted-foreground mt-3">
        Асуулт, санал хүсэлтээ бидэнд илгээгээрэй.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
        <div className="space-y-6">
          <div className="border-border bg-secondary/40 space-y-6 rounded-xl border p-6">
            {store.phone && (
              <Item icon={Phone} label="Утас">
                <a href={`tel:${store.phone}`} className="hover:text-gold-strong font-medium transition-colors">
                  {store.phone}
                </a>
              </Item>
            )}
            {store.email && (
              <Item icon={Mail} label="Имэйл">
                <a href={`mailto:${store.email}`} className="hover:text-gold-strong font-medium transition-colors">
                  {store.email}
                </a>
              </Item>
            )}
            {store.address && (
              <Item icon={MapPin} label="Хаяг">
                <p className="font-medium">{store.address}</p>
              </Item>
            )}
            <Item icon={Clock} label="Хүргэлт">
              <p className="font-medium">
                Өдөр бүр {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна
              </p>
            </Item>
          </div>

          {(social.instagram || social.facebook) && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Сошиал хаяг
              </p>
              {social.instagram && (
                <Social
                  icon={Instagram}
                  href={social.instagram}
                  name="Instagram"
                  handle={`@${handleFromUrl(social.instagram)}`}
                />
              )}
              {social.facebook && (
                <Social
                  icon={Facebook}
                  href={social.facebook}
                  name="Facebook"
                  handle={handleFromUrl(social.facebook)}
                />
              )}
            </div>
          )}
        </div>

        <ContactForm />
      </div>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-gold-strong mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Social({
  icon: Icon,
  href,
  name,
  handle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  name: string;
  handle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group border-border hover:border-gold-strong/50 flex items-center gap-3 rounded-xl border p-4 transition-colors"
    >
      <span className="border-border bg-secondary text-muted-foreground group-hover:text-gold-strong flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-medium">{name}</span>
        <span className="text-muted-foreground group-hover:text-gold-strong block text-sm transition-colors">
          {handle}
        </span>
      </span>
    </a>
  );
}
