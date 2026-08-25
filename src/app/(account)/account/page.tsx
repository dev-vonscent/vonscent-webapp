"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Package,
  Heart,
  Pencil,
  BadgeCheck,
  ChevronRight,
  LogOut,
  Mail,
  Phone,
  Palette,
  Boxes,
} from "lucide-react";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/browser";
import { useWishlist } from "@/features/wishlist/store";
import { AddressBook } from "@/features/account/components/address-book";
import { PasscodeChange } from "@/features/account/components/passcode-change";
import { PhoneVerify } from "@/features/account/components/phone-verify";

export default function ProfilePage() {
  const [email, setEmail] = React.useState("");
  const [userId, setUserId] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [loyalty, setLoyalty] = React.useState(0);
  const [pendingPoints, setPendingPoints] = React.useState(0);
  const [ordersCount, setOrdersCount] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [configured, setConfigured] = React.useState(true);
  const [saved, setSaved] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const wishCount = useWishlist((s) => s.ids.length);
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
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.user.id);
        setOrdersCount(count ?? 0);
      }
      setLoaded(true);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !userId) return;
    await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", userId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prepared = await prepareUpload(file, 512);
    if (!prepared.ok) {
      setAvatarError(prepared.message);
      return;
    }
    setAvatarError(null);
    const fd = new FormData();
    fd.append("file", prepared.file);
    fd.append("folder", "avatars");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return;
    const { url } = await res.json();
    if (!url) return;
    const supabase = createClient();
    if (supabase && userId) {
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
    }
    setAvatar(url);
  }

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
        {/* Avatar ring */}
        <div className="relative shrink-0">
          <div className="bg-secondary rounded-full p-0.75">
            <div className="group border-background bg-secondary relative size-28 overflow-hidden rounded-full border-2 sm:size-32">
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
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6 text-white" />
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  disabled={!configured}
                  onChange={onAvatar}
                />
              </label>
            </div>
          </div>
          {phoneVerified && (
            <span className="bg-foreground text-background absolute right-1 bottom-1 flex items-center justify-center rounded-full p-1">
              <BadgeCheck className="size-4" />
            </span>
          )}
          {avatarError && (
            <p className="text-destructive absolute top-full left-1/2 mt-2 w-52 -translate-x-1/2 text-center text-xs">
              {avatarError}
            </p>
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
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="size-4" /> {editing ? "Хаах" : "Засах"}
            </Button>
          </div>
        </div>
      </header>

      {/* Editable info — revealed by "Засах" */}
      {editing && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <h2 className="font-serif text-lg font-semibold">
              Хувийн мэдээлэл
            </h2>
            <Separator />
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Имэйл</Label>
                <Input id="email" value={email} disabled placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Нэр</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Утас</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                  />
                  {phoneVerified && <Badge variant="new">Баталгаажсан</Badge>}
                </div>
                <PhoneVerify
                  phone={phone}
                  verified={phoneVerified}
                  onVerified={() => setPhoneVerified(true)}
                />
              </div>
              <Button type="submit" disabled={!configured}>
                {saved ? "Хадгалагдлаа" : "Хадгалах"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="space-y-2">
        <OptionRow
          href="/account/loyalty"
          image="/v-point.png"
          label={String(loyalty)}
          // Locked points are shown beside the balance so the number the
          // customer just earned isn't simply missing (todo.md B4).
          value={pendingPoints > 0 ? `+${pendingPoints} түгжээтэй` : undefined}
        />
        <OptionRow
          href="/account/orders"
          icon={Package}
          label="Миний захиалга"
          value={ordersCount}
        />
        <OptionRow
          href="/wishlist"
          icon={Heart}
          label="Хүслүүд"
          value={wishCount}
        />
        <OptionRow href="/account/collections" icon={Boxes} label="Миний багцууд" />
        <OptionRow icon={Mail} label="Имэйл" value={email || "—"} />
        <OptionRow icon={Phone} label="Утас" value={phone || "—"} />
      </div>

      {/* Theme */}
      <div className="bg-card flex items-center gap-4 rounded-xl p-4">
        <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Palette className="size-5" />
        </span>
        <span className="font-medium">Загвар</span>
        <ThemeSwitcher className="ml-auto" />
      </div>

      {/* Passcode change — phone accounts only (the 4-digit code is theirs;
          an email/OAuth account would just get a 401 from the route). */}
      {configured && email.endsWith("@phone.vonscent.mn") && (
        <div className="bg-card rounded-xl p-4">
          <PasscodeChange />
        </div>
      )}

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
          className="w-full bg-red-950 text-red-400 hover:bg-red-900 hover:text-red-400"
          onClick={signOut}
        >
          <LogOut className="size-4" /> Гарах
        </Button>
      )}
    </div>
  );
}

function OptionRow({
  href,
  icon: Icon,
  image,
  label,
  value,
}: {
  href?: string;
  icon?: React.ElementType;
  image?: string;
  label: string;
  value?: string | number;
}) {
  const content = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
          image ? "bg-transparent" : "bg-secondary"
        }`}
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={40}
            height={40}
            className="size-full object-cover"
          />
        ) : (
          Icon && <Icon className="size-5" />
        )}
      </span>
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground ml-auto flex min-w-0 items-center gap-2 text-sm">
        {value !== undefined && <span className="truncate">{value}</span>}
        {href && <ChevronRight className="size-5 shrink-0" />}
      </span>
    </>
  );
  const base = "flex items-center gap-4 rounded-xl bg-card p-4";
  return href ? (
    <Link href={href} className={`${base} hover:bg-accent transition-colors`}>
      {content}
    </Link>
  ) : (
    <div className={base}>{content}</div>
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
