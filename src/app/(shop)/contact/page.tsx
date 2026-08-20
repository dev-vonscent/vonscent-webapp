import type { Metadata } from "next";
import { Phone, Mail, MapPin, Instagram, Facebook } from "lucide-react";
import { ContactForm } from "@/features/contact/components/contact-form";

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

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">
        Холбоо барих
      </h1>
      <p className="text-muted-foreground mt-3">
        Асуулт, санал хүсэлтээ бидэнд илгээгээрэй.
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <Item icon={Phone} label="Утас" value="+976 8000 0000" />
          <Item icon={Mail} label="Имэйл" value="hello@vonscent.mn" />
          <Item
            icon={MapPin}
            label="Хаяг"
            value="Улаанбаатар, Сүхбаатар дүүрэг"
          />
          <div className="flex gap-3 pt-2">
            <Social icon={Instagram} />
            <Social icon={Facebook} />
          </div>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="text-primary mt-0.5 size-5" />
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Social({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href="#"
      className="border-border hover:border-primary hover:text-primary rounded-full border p-2.5 transition-colors"
    >
      <Icon className="size-5" />
    </a>
  );
}
