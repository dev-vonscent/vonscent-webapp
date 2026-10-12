import { FacebookIcon, InstagramIcon } from "@/components/icons/brand-icons";
import { getSocialSettings } from "@/features/content/api";
import {
  ChatWidget,
  type ContactLink,
} from "@/features/chat/components/chat-widget";

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
      icon: InstagramIcon,
    },
    social.facebook && {
      href: social.facebook,
      label: "Facebook",
      icon: FacebookIcon,
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

/** Instagram хаягаас DM-ийн шууд холбоос (`ig.me/m/<хэрэглэгч>`). */
function instagramDmHref(instagram: string) {
  try {
    const slug = new URL(instagram).pathname.split("/").filter(Boolean)[0];
    return slug ? `https://ig.me/m/${slug}` : instagram;
  } catch {
    return instagram;
  }
}

/** Баруун доод булангийн чатын товч — Crisp + сошиал сувгууд (chat-widget.tsx). */
export async function ContactFab() {
  const social = await getSocialSettings();
  const items: ContactLink[] = [
    social.facebook && {
      href: messengerHref(social.facebook),
      label: "Messenger",
      icon: "messenger" as const,
    },
    social.instagram && {
      href: instagramDmHref(social.instagram),
      label: "Instagram DM",
      icon: "instagram" as const,
    },
    social.phone && {
      href: `tel:${social.phone.replace(/\s+/g, "")}`,
      label: social.phone,
      icon: "phone" as const,
    },
  ].filter((l): l is ContactLink => Boolean(l));
  return <ChatWidget links={items} />;
}

/**
 * Гар утасны цэсний сошиал хэсэг — гарчигтай, тусдаа. Хаяг тохируулаагүй бол
 * гарчигтайгаа хамт бүтэн алга болно.
 */
export async function MenuSocialLinks() {
  const items = await links();
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="menu-social-heading"
      style={{ animationDelay: "300ms" }}
      className="animate-fade-up animation-duration-[380ms] mt-7 motion-reduce:animate-none"
    >
      <h2
        id="menu-social-heading"
        className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase"
      >
        Биднийг дагаарай
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map(({ href, label, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-secondary flex h-12 items-center gap-2.5 rounded-2xl border px-4 text-sm font-medium transition-colors"
          >
            <Icon className="size-5 shrink-0" />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
