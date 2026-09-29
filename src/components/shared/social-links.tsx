import { Facebook, Instagram } from "lucide-react";
import { getSocialSettings } from "@/features/content/api";
import { cn } from "@/lib/utils";

/**
 * Толгой ба гар утасны цэсэн дэх Facebook / Instagram холбоос (клиент,
 * 2026-09 UG). Хаягууд нь админы «Контент → Сошиал»-оос — footer, контакт
 * хуудастай нэг эх сурвалж.
 *
 * Server component: `SiteHeader` нь client тул layout энийг `Suspense`-ээр
 * боож slot болгон дамжуулна — тохиргооны уншилт толгойг хүлээлгэхгүй.
 */
async function links() {
  const social = await getSocialSettings();
  return [
    social.instagram && {
      href: social.instagram,
      label: "Instagram",
      icon: Instagram,
    },
    social.facebook && {
      href: social.facebook,
      label: "Facebook",
      icon: Facebook,
    },
  ].filter((l): l is Exclude<typeof l, "" | undefined> => Boolean(l));
}

/** Desktop толгойн баруун тал — дүрс товч, хайлтын хажууд. */
export async function HeaderSocialLinks({ className }: { className?: string }) {
  const items = await links();
  if (items.length === 0) return null;
  return (
    <div className={cn("flex items-center", className)}>
      {items.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-muted-foreground hover:bg-secondary/60 hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
        >
          <Icon className="size-4" />
        </a>
      ))}
    </div>
  );
}

/** Гар утасны цэсний капсул эгнээ — «Холбоо барих» г.м-тэй нэг хэлбэр. */
export async function MenuSocialLinks() {
  const items = await links();
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-secondary hover:bg-accent flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
        >
          <Icon className="text-muted-foreground size-4 shrink-0" />
          {label}
        </a>
      ))}
    </>
  );
}
