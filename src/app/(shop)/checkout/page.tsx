"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  MapPin,
  CreditCard,
  Truck,
  Sparkles,
  ShieldCheck,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkoutSchema } from "@/lib/validators/order";
import {
  SHIPPING_ZONES,
  FREE_SHIP_OVER,
  PAYMENT_METHODS,
  type ShippingZoneConfig,
} from "@/lib/constants";
import { shipsToday, SAME_DAY_CUTOFF_HOUR } from "@/lib/time";
import { resolveZone, zoneKey } from "@/lib/geo/zone";
import {
  AddressFields,
  composeDetail,
} from "@/features/checkout/components/address-fields";
import { formatPrice } from "@/lib/format";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { createClient } from "@/lib/supabase/browser";
import type { AddressRow } from "@/db/types";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

interface ShippingSettingsShape {
  zones: {
    code?: string;
    name: string;
    fee: number;
    deliverable?: boolean;
    remote?: boolean;
    areas?: string[];
  }[];
  freeOver: number;
}

/** Ready-made delivery notes the client asked for (gift wrap, call ahead, …). */
const NOTE_OPTIONS = [
  "Бэлгийн боолт хийлгэх",
  "Хүргэхээс өмнө залгах",
  "Өөр хүн хүлээж авна",
  "Ажлын цагаар хүргэх",
];

const formSchema = checkoutSchema.omit({ items: true });
type FormValues = z.infer<typeof formSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const subtotal = useCart(selectSubtotal);
  const coupon = useCart((s) => s.coupon);
  const clear = useCart((s) => s.clear);
  const [mounted, setMounted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [authed, setAuthed] = React.useState(false);
  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = React.useState(0);
  const [redeemRate, setRedeemRate] = React.useState(1);
  const [useLoyalty, setUseLoyalty] = React.useState(false);
  const [saveAddr, setSaveAddr] = React.useState(false);
  // Zones come from admin settings (A10); the constants are only a fallback
  // for demo mode / while the settings row loads.
  const [zones, setZones] = React.useState<ShippingZoneConfig[]>([
    ...SHIPPING_ZONES,
  ]);
  const [freeOver, setFreeOver] = React.useState(FREE_SHIP_OVER);
  const [noteTags, setNoteTags] = React.useState<string[]>([]);
  // Khoroo lives outside the form: it is folded into shipDetail on submit,
  // since orders has no dedicated column for it.
  const [khoroo, setKhoroo] = React.useState<number | null>(null);
  // A ref, not state: we re-submit from the modal's click handler and the flag
  // has to be visible to onSubmit in that same tick.
  const guestWarned = React.useRef(false);
  const [showGuestWarning, setShowGuestWarning] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [couponMsg, setCouponMsg] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [offers, setOffers] = React.useState<AvailableCoupon[]>([]);
  const setCoupon = useCart((s) => s.setCoupon);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shipCity: "",
      shipZone: SHIPPING_ZONES[0].code,
      paymentMethod: "qpay",
    },
  });

  // Delivery zones + free-shipping threshold are admin-configurable (A10).
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "shipping")
        .maybeSingle();
      const v = (data as { value?: Partial<ShippingSettingsShape> } | null)
        ?.value;
      if (!v) return;
      if (Array.isArray(v.zones) && v.zones.length) {
        const loaded = v.zones.map((z) => ({
          code: z.code?.trim() || z.name,
          name: z.name,
          fee: Number(z.fee) || 0,
          // rows saved before this field existed are deliverable by default
          deliverable: z.deliverable !== false,
          remote: z.remote === true,
          areas: Array.isArray(z.areas) ? z.areas : [],
        }));
        setZones(loaded);
        const first = loaded.find((z) => z.deliverable) ?? loaded[0];
        if (first) setValue("shipZone", zoneKey(first));
      }
      if (typeof v.freeOver === "number") setFreeOver(v.freeOver);
    })();
  }, [setValue]);

  React.useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    if (!supabase) return;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setAuthed(true);
      const [{ data: profile }, { data: addrs }, { data: setting }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, phone, loyalty_points")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("addresses")
            .select("*")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false }),
          supabase
            .from("settings")
            .select("value")
            .eq("key", "loyalty")
            .maybeSingle(),
        ]);
      const p = profile as {
        full_name?: string;
        phone?: string;
        loyalty_points?: number;
      } | null;
      if (p?.full_name) setValue("contactName", p.full_name);
      if (p?.phone) setValue("contactPhone", p.phone);
      if (user.email) setValue("contactEmail", user.email);
      setLoyaltyPoints(p?.loyalty_points ?? 0);
      setAddresses((addrs as AddressRow[] | null) ?? []);
      const rate = (setting as { value?: { redeemRate?: number } } | null)
        ?.value?.redeemRate;
      if (rate) setRedeemRate(rate);
    })();
  }, [setValue]);

  // Offer the codes this customer can actually use, rather than expecting
  // them to remember one (todo.md B4). Re-asked whenever the cart total moves,
  // since a coupon's minimum may only just have been met.
  React.useEffect(() => {
    if (!mounted || subtotal <= 0 || coupon) {
      setOffers([]);
      return;
    }
    let cancelled = false;
    fetch("/api/coupons/available", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtotal }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setOffers(data?.coupons ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mounted, subtotal, coupon]);

  const zone = watch("shipZone");
  const payment = watch("paymentMethod");
  const city = watch("shipCity");
  const district = watch("shipDistrict");

  // Zone follows the address wherever the admin has mapped it (B5b). The
  // server re-derives it the same way, so this only keeps the displayed fee
  // honest — it is not what the customer is charged on.
  const autoZone = React.useMemo(
    () => resolveZone(zones, { city, district, khoroo }),
    [zones, city, district, khoroo],
  );
  React.useEffect(() => {
    if (autoZone) setValue("shipZone", autoZone);
  }, [autoZone, setValue]);
  const selectedZone = zones.find((z) => zoneKey(z) === zone) ?? zones[0];
  const zoneBlocked = selectedZone ? !selectedZone.deliverable : false;
  const shippingFee =
    zoneBlocked || !selectedZone
      ? 0
      : subtotal >= freeOver
        ? 0
        : selectedZone.fee;

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const maxLoyalty = Math.min(
    Math.floor(loyaltyPoints * redeemRate),
    Math.max(subtotal + shippingFee - discount, 0),
  );
  const loyaltyApplied = useLoyalty ? maxLoyalty : 0;
  const total = Math.max(subtotal + shippingFee - discount - loyaltyApplied, 0);

  function selectAddress(id: string) {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setValue("contactName", a.recipient);
    setValue("contactPhone", a.phone);
    setValue("shipCity", a.city);
    setValue("shipDistrict", a.district ?? "");
    setValue("shipDetail", a.detail);
    setKhoroo(null); // detail already carries the khoroo text
  }

  if (mounted && items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-28 text-center md:px-8">
        <span className="bg-secondary flex size-16 items-center justify-center rounded-full">
          <ShoppingCart className="text-muted-foreground size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold">
            Сагс хоосон байна
          </h1>
          <p className="text-muted-foreground text-sm">
            Захиалга өгөхийн тулд эхлээд бараа нэмнэ үү.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/catalog">Бараа үзэх</Link>
        </Button>
      </div>
    );
  }

  async function applyCoupon() {
    if (!code.trim()) return;
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setCoupon({
          code: data.code ?? code.trim().toUpperCase(),
          discount: data.discount,
        });
        setCode("");
      } else {
        setCoupon(null);
        setCouponMsg(data.message ?? "Купон хүчингүй байна.");
      }
    } catch {
      setCouponMsg("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setApplying(false);
    }
  }

  async function onSubmit(values: FormValues) {
    // Zones we don't serve must never turn into an order.
    if (zoneBlocked) {
      setServerError(
        "Сонгосон бүсэд хүргэлт хийх боломжгүй байна. Өөр бүс сонгоно уу.",
      );
      return;
    }
    // Guests get one explicit heads-up that they forfeit V point before we
    // take their money (requirement_fb.md §5).
    if (!authed && !guestWarned.current) {
      setShowGuestWarning(true);
      return;
    }

    setSubmitting(true);
    setServerError(null);
    // Fold the quick-pick delivery options into the free-text note.
    const note = [noteTags.join(" · "), values.note?.trim()]
      .filter(Boolean)
      .join(" — ");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          shipKhoroo: khoroo,
          shipDetail: composeDetail(khoroo, values.shipDetail),
          note: note || undefined,
          couponCode: coupon?.code,
          loyaltyUsed: loyaltyApplied,
          saveAddress: saveAddr,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            ml: i.ml,
            qty: i.qty,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(
          data.error === "OUT_OF_STOCK"
            ? "Уучлаарай, зарим бараа дууссан байна."
            : data.error === "ZONE_UNAVAILABLE"
              ? "Сонгосон бүсэд хүргэлт хийх боломжгүй байна."
              : "Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.",
        );
        return;
      }
      const order = await res.json();
      sessionStorage.setItem(
        "vonscent-last-order",
        JSON.stringify({
          orderNo: order.orderNo,
          total: order.total,
          paymentMethod: order.paymentMethod,
          contactName: values.contactName,
          qpay: order.qpay ?? null,
          qpayMock: order.qpayMock ?? false,
        }),
      );
      clear();
      router.push("/order/success");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[88rem] px-4 py-8 md:px-8">
      <div className="mb-8">
        <Link
          href="/cart"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          ← Сагс руу буцах
        </Link>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
          Захиалга өгөх
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-10"
      >
        <div className="space-y-6">
          {/* Guest prompt: register to earn loyalty points */}
          {mounted && !authed && (
            <div className="bg-secondary flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm">
              <Sparkles className="text-gold-strong mt-0.5 size-4 shrink-0" />
              <p>
                <Link
                  href="/register"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Бүртгүүлээд
                </Link>{" "}
                захиалга бүртээ V point цуглуулаарай. Зочноор захиалга хийвэл
                оноо хуримтлуулахгүй.
              </p>
            </div>
          )}

          {/* Saved addresses */}
          {authed && addresses.length > 0 && (
            <Section step={0} icon={MapPin} title="Хадгалсан хаяг">
              <Select onValueChange={selectAddress}>
                <SelectTrigger>
                  <SelectValue placeholder="Хадгалсан хаягаас сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.recipient} — {a.city}
                      {a.district ? `, ${a.district}` : ""}, {a.detail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>
          )}

          {/* Contact */}
          <Section step={1} icon={User} title="Холбоо барих">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Нэр" error={errors.contactName?.message}>
                <Input {...register("contactName")} placeholder="Таны нэр" />
              </Field>
              <Field label="Утас" error={errors.contactPhone?.message}>
                <Input
                  {...register("contactPhone")}
                  placeholder="99112233"
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field
              label="Имэйл (заавал биш)"
              error={errors.contactEmail?.message}
            >
              <Input
                {...register("contactEmail")}
                placeholder="name@mail.com"
              />
            </Field>
          </Section>

          {/* Shipping */}
          <Section step={2} icon={MapPin} title="Хүргэлтийн хаяг">
            <AddressFields
              value={{
                city: watch("shipCity") ?? "",
                district: watch("shipDistrict") ?? "",
                khoroo,
              }}
              onChange={(next) => {
                setValue("shipCity", next.city);
                setValue("shipDistrict", next.district);
                setKhoroo(next.khoroo);
              }}
              errors={{
                city: errors.shipCity?.message,
                district: errors.shipDistrict?.message,
              }}
            />
            <Field label="Дэлгэрэнгүй хаяг" error={errors.shipDetail?.message}>
              <Input
                {...register("shipDetail")}
                placeholder="Байр, орц, тоот"
              />
            </Field>
            <Field label="Хүргэлтийн бүс" error={errors.shipZone?.message}>
              <Select
                value={zone}
                onValueChange={(v) => setValue("shipZone", v)}
                disabled={Boolean(autoZone)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={zoneKey(z)} value={zoneKey(z)}>
                      {z.name}
                      {z.deliverable
                        ? ` — ${formatPrice(z.fee)}`
                        : " — хүргэлтгүй"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {autoZone && (
                <p className="text-muted-foreground text-xs">
                  Бүс нь сонгосон хаягаас автоматаар тодорхойлогдлоо.
                </p>
              )}
            </Field>

            {zoneBlocked && (
              <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2.5 text-sm">
                Уучлаарай, энэ бүсэд хүргэлт хийх боломжгүй. Өөр бүс сонгох
                эсвэл бидэнтэй холбогдоно уу.
              </p>
            )}
            {selectedZone?.remote && !zoneBlocked && (
              <p className="bg-secondary rounded-xl px-3 py-2.5 text-sm">
                Орон нутгийн хүргэлт: <strong>унаа явах газраа</strong> доорх
                тэмдэглэл хэсэгт заавал бичнэ үү.
              </p>
            )}

            <div className="space-y-2">
              <Label>Нэмэлт сонголт (заавал биш)</Label>
              <div className="flex flex-wrap gap-2">
                {NOTE_OPTIONS.map((opt) => {
                  const on = noteTags.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setNoteTags((t) =>
                          on ? t.filter((x) => x !== opt) : [...t, opt],
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? "bg-foreground text-background"
                          : "bg-secondary hover:bg-accent"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Нэмэлт тэмдэглэл (заавал биш)">
              <Input
                {...register("note")}
                placeholder="Жишээ: оройн цагаар залгаарай"
              />
            </Field>
            {authed && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={saveAddr}
                  onCheckedChange={(v) => setSaveAddr(Boolean(v))}
                />
                Энэ хаягийг хадгалах
              </label>
            )}
          </Section>

          {/* Payment */}
          <Section step={3} icon={CreditCard} title="Төлбөрийн арга">
            <RadioGroup
              value={payment}
              onValueChange={(v) =>
                setValue("paymentMethod", v as FormValues["paymentMethod"])
              }
              className="gap-3"
            >
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.value}
                  className="bg-secondary hover:bg-accent has-checked:ring-foreground flex cursor-pointer items-center gap-3 rounded-xl p-4 ring-2 ring-transparent transition-all"
                >
                  <RadioGroupItem value={m.value} />
                  <span className="text-sm font-medium">{m.label}</span>
                </label>
              ))}
            </RadioGroup>
          </Section>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-6">
              <h2 className="font-serif text-lg font-semibold">
                Захиалгын тойм
              </h2>

              <div className="space-y-3">
                {mounted &&
                  items.map((i) => (
                    <div key={i.key} className="flex items-center gap-3">
                      <div className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-xl">
                        {i.image && (
                          <Image
                            src={i.image}
                            alt={i.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        )}
                        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                          {i.qty}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-tight font-medium">
                          {i.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {i.brand} · {i.ml}ml
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(i.unitPrice * i.qty)}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="gold-rule" />

              {/* Coupon — also offered here, not just in the cart. */}
              {coupon ? (
                <div className="bg-secondary flex items-center justify-between rounded-xl px-3 py-2.5 text-sm">
                  <span>
                    Купон <strong>{coupon.code}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCoupon(null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Хасах
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Купон код"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applying}
                    onClick={applyCoupon}
                  >
                    {applying ? "…" : "Хэрэглэх"}
                  </Button>
                </div>
              )}
              {couponMsg && (
                <p className="text-destructive text-xs">{couponMsg}</p>
              )}
              {!coupon && offers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs">
                    Танд боломжтой купон
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {offers.map((o) => (
                      <button
                        key={o.code}
                        type="button"
                        onClick={() => {
                          setCoupon({ code: o.code, discount: o.discount });
                          setCouponMsg(null);
                        }}
                        className="bg-secondary hover:bg-accent rounded-full px-3 py-1.5 text-xs transition-colors"
                      >
                        <span className="font-mono font-semibold">
                          {o.code}
                        </span>
                        {" · −"}
                        {formatPrice(o.discount)}
                        {o.personal && " · танд"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Дэд дүн</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Купон {coupon?.code}
                    </span>
                    <span className="text-success">
                      −{formatPrice(discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Truck className="size-4" /> Хүргэлт
                  </span>
                  <span>
                    {shippingFee === 0 ? "Үнэгүй" : formatPrice(shippingFee)}
                  </span>
                </div>
              </div>

              {/* Loyalty */}
              {authed && maxLoyalty > 0 && (
                <label className="bg-secondary flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={useLoyalty}
                      onCheckedChange={(v) => setUseLoyalty(Boolean(v))}
                    />
                    V point ашиглах ({loyaltyPoints})
                  </span>
                  {useLoyalty && (
                    <span className="text-success">
                      −{formatPrice(loyaltyApplied)}
                    </span>
                  )}
                </label>
              )}

              <div className="gold-rule" />

              <div className="flex items-baseline justify-between">
                <span className="font-medium">Нийт төлөх</span>
                <span className="font-serif text-2xl font-semibold">
                  {formatPrice(total)}
                </span>
              </div>

              {serverError && (
                <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2.5 text-sm">
                  {serverError}
                </p>
              )}

              {/* Dispatch cut-off reminder (requirement_fb.md §5). */}
              {mounted && (
                <p className="bg-secondary rounded-xl px-3 py-2.5 text-xs leading-relaxed">
                  <Clock className="mr-1 inline size-3.5 align-[-2px]" />
                  {shipsToday()
                    ? `Өнөөдрийн ${SAME_DAY_CUTOFF_HOUR}:00 цагаас өмнөх захиалга өнөөдөртөө хүргэгдэнэ.`
                    : `${SAME_DAY_CUTOFF_HOUR}:00 цаг өнгөрсөн тул захиалга маргааш хүргэгдэнэ.`}{" "}
                  Хүргэх өдрийн <strong>10:00</strong> цагаас хойш захиалга
                  цуцлах, өөрчлөх боломжгүй.
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || zoneBlocked}
              >
                {submitting
                  ? "Илгээж байна…"
                  : zoneBlocked
                    ? "Энэ бүсэд хүргэлт хийхгүй"
                    : "Захиалга баталгаажуулах"}
              </Button>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
                <ShieldCheck className="size-3.5" />
                Баталгаажуулснаар та үйлчилгээний нөхцөлийг зөвшөөрнө.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Guest consent: V point is forfeited unless they register first. */}
      {showGuestWarning && (
        <div className="bg-foreground/40 fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm space-y-4 rounded-2xl p-6 text-center shadow-xl">
            <Sparkles className="text-gold-strong mx-auto size-7" />
            <h2 className="font-serif text-xl font-semibold">
              Оноо цуглуулахгүй байхаар байна
            </h2>
            <p className="text-muted-foreground text-sm">
              Зочноор захиалга хийвэл энэ захиалгын{" "}
              <strong>V point хуримтлагдахгүй</strong>. Бүртгүүлбэл үнийн
              дүнгийн 1%-ийг оноогоор буцаан авах боломжтой.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href="/register">Бүртгүүлэх</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  guestWarned.current = true;
                  setShowGuestWarning(false);
                  handleSubmit(onSubmit)();
                }}
              >
                Зочноор үргэлжлүүлэх
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  step,
  icon: Icon,
  title,
  children,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
          {step > 0 ? (
            <span className="text-sm font-semibold">{step}</span>
          ) : (
            <Icon className="size-[18px]" />
          )}
        </span>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
