"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  BadgeCheck,
  ChevronRight,
  KeyRound,
  LogOut,
  Palette,
  Pencil,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { useWishlist } from "@/features/wishlist/store";
import { AddressBook } from "@/features/account/components/address-book";
import { PasscodeDialog } from "@/features/account/components/passcode-dialog";
import { ProfileEditDialog } from "@/features/account/components/profile-edit-dialog";
import type { ProductListItem } from "@/lib/types";

export default function ProfilePage() {
  const [email, setEmail] = React.useState("");
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
  const wishCount = wishIds.length;
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

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
        setEmail(data.user.email ?? "");
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
            .eq("user_id", data.user.id),
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
        setSaleWishCount(data.items.filter((p) => p.salePct > 0).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wishIds]);

  if (!loaded) return <div className="h-40" />;

  const initial = (fullName || email || "?").charAt(0).toUpperCase();
  const handle = (email.split("@")[0] || "vonscent").toLowerCase();

  return (
    <div className="space-y-8">
      {!configured && (
        <p className="border-border bg-secondary text-muted-foreground rounded-xl border px-4 py-3 text-sm">
          Нэвтрэлт одоогоор тохируулагдаагүй (demo). Supabase холбогдсоны дараа
          таны мэдээлэл энд харагдана.
        </p>
      )}

      {/* Instagram-style profile header */}
      <header className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative shrink-0">
          <div className="bg-secondary rounded-full p-0.75">
            <div className="border-background bg-secondary relative size-28 overflow-hidden rounded-full border-2 sm:size-32">
              {avatar ? (
                <Image
                  src={avatar}
                  alt="avatar"
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center font-serif text-4xl">
                  {initial}
                </div>
              )}
            </div>
          </div>
          {phoneVerified && (
            <span className="bg-foreground text-background absolute right-1 bottom-1 flex items-center justify-center rounded-full p-1">
              <BadgeCheck className="size-4" />
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4 text-center sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-serif text-2xl font-semibold sm:text-3xl">
                {fullName || "vonscent гишүүн"}
              </h1>
              <p className="text-muted-foreground text-sm">@{handle}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="sm:ml-auto"
              onClick={() => setProfileOpen(true)}
            >
              <Pencil className="size-4" /> Засах
            </Button>
          </div>
        </div>
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
          kicker="Багцууд"
          value={collectionsCount}
        />
      </div>

      {/* Settings rows */}
      <div className="space-y-2">
        <div className="bg-card flex items-center gap-4 rounded-xl p-4">
          <IconCircle icon={Palette} />
          <span className="font-medium">Загвар</span>
          <ThemeSwitcher className="ml-auto" />
        </div>

        {/* Passcode change — phone accounts only (the 4-digit code is theirs;
            an email/OAuth account would just get a 401 from the route). */}
        {configured && email.endsWith("@phone.vonscent.mn") && (
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

      {/* Delivery addresses */}
      {configured && <AddressBook />}

      {/* Available coupons */}
      {configured && (
        <div id="coupons" className="scroll-mt-24">
          <Coupons />
        </div>
      )}

      {/* Sign out */}
      {configured && (
        <Button
          variant="ghost"
          className="bg-destructive/10 text-destructive hover:bg-destructive/18 hover:text-destructive w-full"
          onClick={signOut}
        >
          <LogOut className="size-4" /> Гарах
        </Button>
      )}

      <ProfileEditDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        userId={userId}
        configured={configured}
        email={email}
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

function IconCircle({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
      <Icon className="size-4" />
    </span>
  );
}

// Link needs to be a motion component so the tile can own the hover state.
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
  // hide and glide out from behind the kicker.
  const [hoverCapable, setHoverCapable] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHoverCapable(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = React.useState(false);
  const tucked = hoverCapable && !reduceMotion && !active;

  return (
    <MotionLink
      href={href}
      initial={false}
      onHoverStart={() => setActive(true)}
      onHoverEnd={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
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
        {/* Animating opacity/x only — the span keeps its slot in the flow at
            every state, so the tile never reflows. */}
        <motion.span
          aria-hidden
          className="text-muted-foreground group-hover:text-foreground ml-auto shrink-0 transition-colors"
          initial={false}
          animate={{ opacity: tucked ? 0 : 1, x: tucked ? -16 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
        >
          <ChevronRight className="size-4" />
        </motion.span>
      </div>
      <p className="font-serif text-2xl/snug font-semibold tabular-nums">
        {value}
      </p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </MotionLink>
  );
}

interface PublicCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  ends_at: string | null;
  /** Set = issued to this customer alone (0020_user_coupons). */
  user_id: string | null;
}

function Coupons() {
  const [items, setItems] = React.useState<PublicCoupon[]>([]);
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    // RLS narrows this to public coupons plus the ones issued to this
    // customer — someone else's personal code never reaches the browser.
    supabase
      .from("coupons")
      .select("id, code, type, value, min_subtotal, ends_at, user_id")
      .eq("is_active", true)
      .then(({ data }) => setItems((data as PublicCoupon[] | null) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="font-serif text-lg font-semibold">Идэвхтэй купонууд</h2>
        <div className="space-y-2">
          {items.map((c) => (
            <div
              key={c.id}
              className="bg-secondary flex items-center justify-between rounded-md px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono font-semibold">{c.code}</span>
                {c.user_id && (
                  <span className="bg-primary/15 text-gold-strong rounded-full px-2 py-0.5 text-[11px]">
                    Танд зориулав
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {c.type === "percent"
                  ? `${c.value}% хямдрал`
                  : `${c.value.toLocaleString()}₮ хямдрал`}
                {c.min_subtotal > 0
                  ? ` · ${c.min_subtotal.toLocaleString()}₮-өөс`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
