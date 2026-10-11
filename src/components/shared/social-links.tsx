import { Facebook, Instagram } from "lucide-react";
import { getSocialSettings } from "@/features/content/api";
import { ChatWidget } from "@/features/chat/components/chat-widget";

/**
 * Гар утасны цэсэн дэх Facebook / Instagram холбоос ба desktop-ийн
 * «Холбогдох» товч (клиент, 2026-09 UG). Хаягууд нь админы «Контент → Сошиал»-оос — footer, контакт
 * хуудастай нэг эх сурвалж.
 *
 * Server component: layout эдгээрийг `Suspense`-ээр боож дамжуулна —
 * тохиргооны уншилт толгойг хүлээлгэхгүй. Desktop толгойд сошиал дүрс
 * байхгүй: худалдан авалтын хамгийн ил газраас сайтаас гадагш хөтлөх нь
 * алдагдалтай тул баруун доод булангийн товч руу шилжсэн.
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

/**
 * FB хуудасны хаягаас Messenger-ийн шууд чат (`m.me/<хуудас>`) гаргана —
 * хуудас руу биш, яриа руу шууд оруулна. Задлах боломжгүй бол (profile.php?id=
 * г.м) анхны хаягаа буцаана.
 */
function messengerHref(facebook: string) {
  try {
    const slug = new URL(facebook).pathname.split("/").filter(Boolean)[0];
    return slug && slug !== "profile.php" ? `https://m.me/${slug}` : facebook;
  } catch {
    return facebook;
  }
}

/** Баруун доод булангийн чатын товч — Crisp, ачаалагдахгүй бол Messenger (chat-widget.tsx). */
export async function ContactFab() {
  const social = await getSocialSettings();
  return (
    <ChatWidget
      messengerHref={
        social.facebook ? messengerHref(social.facebook) : undefined
      }
    />
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
