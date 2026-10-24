"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BadgeCheck,
  ChevronRight,
  Gem,
  KeyRound,
  LogOut,
  Pencil,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { selectWishCount, useWishlist } from "@/features/wishlist/store";
import { AddressBook } from "@/features/account/components/address-book";
import { PasscodeDialog } from "@/features/account/components/passcode-dialog";
import { ProfileEditDialog } from "@/features/account/components/profile-edit-dialog";
import { EmailSettings } from "@/features/account/components/email-settings";
import { useSignOutConfirm } from "@/features/account/components/use-sign-out-confirm";
import { isPhoneEmail } from "@/lib/auth/phone-email";
import { formatPhone } from "@/lib/format";
import { WheelEntryCard } from "@/features/lucky-wheel/components/wheel-entry-card";
import type { ProductListItem } from "@/lib/types";
import { useFeatureFlag } from "@/components/feature-flags";
import { useMyTier } from "@/features/tiers/use-tier";
import { tierByKey } from "@/features/tiers/lib";
import {
  TierBadge,
  TierFrame,
  TierGem,
} from "@/features/tiers/components/tier-frame";

export default function ProfilePage() {
  const wheelOn = useFeatureFlag("lucky_wheel");
  const tiersOn = useFeatureFlag("user_tiers");
  const { data: tierSummary } = useMyTier();
  const tier = tierSummary ? tierByKey(tierSummary.tier) : null;
  const [askSignOut, signOutDialog] = useSignOutConfirm();
  /** Supabase auth-ийн хаяг — утсаар бүртгүүлсэн хүнд синтетик тул харуулахгүй. */
  const [authEmail, setAuthEmail] = React.useState("");
  /** Хэрэглэгчийн өөрөө бүртгүүлсэн бодит хаяг (newsletter_subscribers). */
  const [contactEmail, setContactEmail] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [loyalty, setLoyalty] = React.useState(0);
  const [pendingPoints, setPendingPoints] = React.useState(0);
  const [ordersCount, setOrdersCount] = React.useState(0);
  const [shippingCount, setShippingCount] = React.useState(0);
  const [collectionsCount, setCollectionsCount] = React.useState(0);
  const [saleWishCount, setSaleWishCount] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [configured, setConfigured] = React.useState(true);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [passcodeOpen, setPasscodeOpen] = React.useState(false);

  const wishIds = useWishlist((s) => s.ids);
  // Ус ба бэлэн багц (0107) хоёулаа «Хүслүүд»-д тоологдоно.
  const wishCount = useWishlist(selectWishCount);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setConfigured(false);
      setLoaded(true);
      return;
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setAuthEmail(data.user.email ?? "");
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "full_name, phone, loyalty_points, pending_points, avatar_url, phone_verified",
          )
          .eq("id", data.user.id)
          .maybeSingle();
        const p = profile as {
          full_name?: string;
          phone?: string;
          loyalty_points?: number;
          pending_points?: number;
          avatar_url?: string | null;
          phone_verified?: boolean;
        } | null;
        setFullName(p?.full_name ?? "");
        setPhone(p?.phone ?? "");
        setLoyalty(p?.loyalty_points ?? 0);
        setPendingPoints(p?.pending_points ?? 0);
        setAvatar(p?.avatar_url ?? null);
        setPhoneVerified(Boolean(p?.phone_verified));
        const [orders, shipping, collections] = await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", data.user.id)
            // Төлөгдөөгүй цуцлалтыг тоолохгүй — жагсаалттай ижил (0124).
            .or("status.neq.cancelled,payment_status.neq.unpaid"),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", data.user.id)
            .eq("status", "shipping"),
          supabase
            .from("collections")
            .select("id", { count: "exact", head: true })
            .eq("type", "custom")
            .eq("user_id", data.user.id),
        ]);
        setOrdersCount(orders.count ?? 0);
        setShippingCount(shipping.count ?? 0);
        setCollectionsCount(collections.count ?? 0);
      }
      setLoaded(true);
    });
  }, []);

  // Хүслүүд tile-ийн дэд мөр: хямдралтай болсон бүтээгдэхүүний тоо.
  React.useEffect(() => {
    if (wishIds.length === 0) {
      setSaleWishCount(0);
      return;
    }
    let cancelled = false;
    fetch(`/api/products?ids=${wishIds.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items: ProductListItem[] } | null) => {
        if (cancelled || !data) return;
        setSaleWishCount(
          data.items.filter((p) => p.startingBasePrice > p.startingPrice)
            .length,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wishIds]);

  if (!loaded) return <div className="h-40" />;

  // Утсаар бүртгүүлсэн данс Supabase дээр `<утас>@phone.vonscent.mn` гэсэн
  // синтетик хаягтай байдаг — түүнийг хаана ч харуулахгүй.
  const realEmail = isPhoneEmail(authEmail) ? "" : authEmail;
  const displayEmail = contactEmail ?? realEmail;
  const initial = (fullName || displayEmail || "?").charAt(0).toUpperCase();
  const avatarContent = avatar ? (
    <Image
      src={avatar}
      alt="avatar"
      fill
      sizes="128px"
      className="object-cover"
    />
  ) : (
    <span className="text-muted-foreground flex h-full items-center justify-center font-serif text-4xl">
      {initial}
    </span>
  );
  // Нэрийн доорх мөр: дэлгүүр хэрэглэгчийг утсаар нь таньдаг (verify.mn) тул
  // эхлээд дугаар, байхгүй бол имэйл. Өмнө нь имэйлийн «@»-ийн өмнөх хэсгийг
  // social маягийн «@handle» болгодог байсан нь имэйл ил гарсан мэт харагдаж байв.
  const subline = phone ? formatPhone(phone) : displayEmail;

  return (
    <div className="space-y-8">
      {!configured && (
        <p className="border-border bg-secondary text-muted-foreground rounded-xl border px-4 py-3 text-sm">
          Нэвтрэлт одоогоор тохируулагдаагүй (demo). Supabase холбогдсоны дараа
          таны мэдээлэл энд харагдана.
        </p>
      )}

      {/* Профайлын толгой: зураг зүүн талд, нэр · утас · түвшин баруун
          талд нь нэг багана болж зэрэгцэнэ (утсан дээр ч); «Засах» баруун
          дээд буланд — утсан дээр зөвхөн icon. */}
      <header className="flex items-center gap-5 sm:gap-8">
        <div className="relative shrink-0">
          {tier ? (
            <Link href="/account/tier" aria-label="Хэрэглэгчийн түвшин">
              <TierFrame
                tier={tier.key}
                className="[--avatar:76px] sm:[--avatar:104px]"
              >
                {avatarContent}
              </TierFrame>
            </Link>
          ) : (
            <div className="bg-secondary rounded-full p-0.75">
              <div className="border-background bg-secondary relative size-24 overflow-hidden rounded-full border-2 sm:size-32">
                {avatarContent}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0">
            {/* Баталгаажсан тэмдэг нэрийн ард — урт нэр тасарсан ч харагдана. */}
            <h1 className="flex min-w-0 items-center gap-1.5 font-serif text-2xl font-semibold sm:text-3xl">
              <span className="truncate">{fullName || "vonscent гишүүн"}</span>
              {phoneVerified && (
                <BadgeCheck
                  aria-label="Утас баталгаажсан"
                  className="fill-foreground text-background size-5 shrink-0 sm:size-6"
                />
              )}
            </h1>
            {subline && (
              <p className="text-muted-foreground truncate text-sm tabular-nums">
                {subline}
              </p>
            )}
          </div>
          {tier && (
            <Link
              href="/account/tier"
              className="inline-flex transition-opacity hover:opacity-80"
            >
              <TierBadge tier={tier.key} />
            </Link>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0 self-start"
          aria-label="Профайл засах"
          onClick={() => setProfileOpen(true)}
        >
          <Pencil className="size-4" />
          <span className="max-sm:sr-only">Засах</span>
        </Button>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          href="/account/loyalty"
          kicker="V Point"
          value={loyalty}
          sub={pendingPoints > 0 ? `+${pendingPoints} түгжээтэй` : undefined}
          gold
        />
        <Tile
          href="/account/orders"
          kicker="Захиалга"
          value={ordersCount}
          sub={
            shippingCount > 0 ? `${shippingCount} замдаа явж байна` : undefined
          }
        />
        <Tile
          href="/wishlist"
          kicker="Хүслүүд"
          value={wishCount}
          sub={saleWishCount > 0 ? `${saleWishCount} хямдарсан` : undefined}
        />
        <Tile
          href="/account/collections"
          kicker="Миний багцууд"
          value={collectionsCount}
        />
      </div>

      {/* Settings rows */}
      <div className="space-y-2">
        {/* Above the settings, not among them: the wheel is something to do,
            and it hides itself when there is nothing to collect. */}
        {configured && wheelOn && <WheelEntryCard />}

        {configured && tiersOn && (
          <Link
            href="/account/tier"
            className="bg-card hover:bg-accent flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors"
          >
            <IconCircle icon={Gem} />
            <span className="font-medium">Түвшин</span>
            {tier && (
              <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-sm">
                <TierGem tier={tier.key} />
                {tier.label} · {tier.rate}%
              </span>
            )}
            <ChevronRight
              className={cn("text-muted-foreground size-4", !tier && "ml-auto")}
            />
          </Link>
        )}

        {/* Купонууд өөрийн хуудсанд шилжсэн (0104) — энд зөвхөн орох зам. */}
        {configured && (
          <Link
            href="/account/coupons"
            className="bg-card hover:bg-accent flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors"
          >
            <IconCircle icon={Ticket} />
            <span className="font-medium">Миний купон</span>
            <ChevronRight className="text-muted-foreground ml-auto size-4" />
          </Link>
        )}

        {/* Passcode change — phone accounts only (the 4-digit code is theirs;
            an email/OAuth account would just get a 401 from the route). */}
        {configured && isPhoneEmail(authEmail) && (
          <button
            onClick={() => setPasscodeOpen(true)}
            className="bg-card hover:bg-accent flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors"
          >
            <IconCircle icon={KeyRound} />
            <span className="font-medium">Нэвтрэх код солих</span>
            <ChevronRight className="text-muted-foreground ml-auto size-4" />
          </button>
        )}
      </div>

      {/* Email notifications — register, change, or switch off */}
      {configured && <EmailSettings onEmailChange={setContactEmail} />}

      {/* Delivery addresses */}
      {configured && <AddressBook />}

      {/* Sign out */}
      {configured && (
        <>
          {signOutDialog}
          <Button
            type="button"
            onClick={askSignOut}
            variant="ghost"
            className="bg-destructive/10 text-destructive hover:bg-destructive/18 hover:text-destructive w-full"
          >
            <LogOut className="size-4" /> Гарах
          </Button>
        </>
      )}

      <ProfileEditDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        userId={userId}
        configured={configured}
        email={displayEmail}
        fullName={fullName}
        phone={phone}
        phoneVerified={phoneVerified}
        avatar={avatar}
        onSaved={(next) => {
          setFullName(next.fullName);
          setPhone(next.phone);
        }}
        onAvatarChange={setAvatar}
        onPhoneVerified={() => setPhoneVerified(true)}
      />
      <PasscodeDialog open={passcodeOpen} onOpenChange={setPasscodeOpen} />
    </div>
  );
}

function IconCircle({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
      <Icon className="size-4" />
    </span>
  );
}

// Link needs to be a motion component for the tap-scale feedback.
const MotionLink = motion.create(Link);

function Tile({
  href,
  kicker,
  value,
  sub,
  gold,
}: {
  href: string;
  kicker: string;
  value: number;
  sub?: string;
  gold?: boolean;
}) {
  // The chevron is the tile's "I'm tappable" signal. Touch devices have no
  // hover, so there it simply stays visible; only on a fine pointer does it
  // hide and glide out from behind the kicker. Pure CSS with a pinned
  // compositor layer: the old JS/WAAPI spring dropped the layer when the
  // exit animation finished, which made the tile just left flicker.
  return (
    <MotionLink
      href={href}
      initial={false}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.6 }}
      className={cn(
        "bg-card hover:bg-accent group rounded-2xl p-4 transition-colors duration-300",
        gold && "border-gold/60 border",
      )}
    >
      <div className="flex items-center gap-2">
        <p
          className={cn(
            "text-sm font-medium",
            gold ? "text-gold" : "text-muted-foreground",
          )}
        >
          {kicker}
        </p>
        {/* Animating opacity/translate only — the span keeps its slot in the
            flow at every state, so the tile never reflows. */}
        <span
          aria-hidden
          className="text-muted-foreground group-hover:text-foreground ml-auto shrink-0 transition-[opacity,translate,color] duration-300 ease-out will-change-[opacity,translate] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 pointer-fine:motion-safe:-translate-x-4 pointer-fine:motion-safe:opacity-0"
        >
          <ChevronRight className="size-4" />
        </span>
      </div>
      <p className="font-serif text-2xl/snug font-semibold tabular-nums">
        {value}
      </p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </MotionLink>
  );
}
