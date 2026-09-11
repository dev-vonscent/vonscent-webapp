"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  MapPin,
  Truck,
  ShieldCheck,
  ShoppingCart,
  Clock,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkoutSchema } from "@/lib/validators/order";
import { SHIPPING_ZONES, type ShippingZoneConfig } from "@/lib/constants";
import {
  bundleGiftGuarantee,
  giftAllowanceFor,
  giftGuaranteeFor,
} from "@/lib/gift";
import { GiftSamplePicker } from "@/features/checkout/components/gift-sample-picker";
import { useGiftPool } from "@/features/gifts/use-gift-pool";
import {
  DISPATCH_HOUR,
  MAX_PREORDER_DAYS,
  ORDER_EDIT_CUTOFF_HOUR,
  formatDeliveryDay,
  ubDayFromNow,
} from "@/lib/time";
import { resolveZone, zoneKey } from "@/lib/geo/zone";
import { composeDetail } from "@/features/checkout/components/address-fields";
import {
  NEW_ADDRESS,
  SavedAddresses,
} from "@/features/checkout/components/saved-addresses";
import {
  AddressDialog,
  type AddressFormValue,
} from "@/features/checkout/components/address-dialog";
import { CouponField } from "@/features/checkout/components/coupon-field";
import { useCoupon } from "@/features/checkout/use-coupon";
import { formatPrice } from "@/lib/format";
import { useCart, selectSubtotal } from "@/features/cart/store";
import {
  useSelectedLines,
  getSelectedLines,
} from "@/features/cart/use-cart-selection";
import { trackBeginCheckout } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/browser";
import type { AddressRow } from "@/db/types";

interface ShippingSettingsShape {
  zones: {
    code?: string;
    name: string;
    fee: number;
    deliverable?: boolean;
    remote?: boolean;
    areas?: string[];
  }[];
}

/**
 * Ready-made delivery notes. Хүргэлтэд үнэхээр өөр үйлдэл шаарддаг хоёрыг л
 * үлдээв — «өөр хүн хүлээж авна» гэдэг нь хүлээн авагчийн мэдээллээр аль
 * хэдийн шийдэгддэг, «ажлын цагаар хүргэх» нь хүргэлтийн цагтай зөрчилддөг.
 */
const NOTE_OPTIONS = ["Бэлгийн боолт хийлгэх", "Хүргэхээс өмнө залгах"];

const formSchema = checkoutSchema.omit({ items: true, collections: true });
type FormValues = z.infer<typeof formSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  // Захиалга сагснаас *сонгосон* мөрүүдийг л авна — сонгоогүй бараа сагсандаа
  // үлдэж, дараа нь тусад нь захиалагдана.
  const { items, collections } = useSelectedLines();
  const cartLineCount = useCart((s) => s.items.length + s.collections.length);
  const subtotal = useCart(selectSubtotal);
  const coupon = useCart((s) => s.coupon);
  const removeOrdered = useCart((s) => s.removeSelected);
  const removeLine = useCart((s) => s.remove);
  const [mounted, setMounted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  // Захиалга үүсээд төлбөрийн хуудас руу шилжих хооронд сагс хоосорсон тул
  // «Сагс хоосон байна» гэсэн хоосон төлөв анивчдаг байсан — router.push нь
  // тэр хооронд хийгддэг. Шилжиж байгаа гэдгээ тусад нь тэмдэглэнэ.
  const [leaving, setLeaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const [authed, setAuthed] = React.useState(false);
  const [addresses, setAddresses] = React.useState<AddressRow[]>([]);
  /** Chosen saved address id, or NEW_ADDRESS for the one typed in the dialog. */
  const [addressChoice, setAddressChoice] = React.useState(NEW_ADDRESS);
  /** Popup-аар оруулсан шинэ хаяг — хадгалсан хаягтай ижил карт болж харагдана. */
  const [draft, setDraft] = React.useState<AddressFormValue | null>(null);
  const [addressOpen, setAddressOpen] = React.useState(false);

  const [loyaltyPoints, setLoyaltyPoints] = React.useState(0);
  const [redeemRate, setRedeemRate] = React.useState(1);
  const [useLoyalty, setUseLoyalty] = React.useState(false);
  const [saveAddr, setSaveAddr] = React.useState(false);
  // Zones come from admin settings (A10); the constants are only a fallback
  // for demo mode / while the settings row loads.
  const [zones, setZones] = React.useState<ShippingZoneConfig[]>([
    ...SHIPPING_ZONES,
  ]);
  const [noteTags, setNoteTags] = React.useState<string[]>([]);
  const [giftIds, setGiftIds] = React.useState<string[]>([]);
  // Khoroo lives outside the form: it is folded into shipDetail on submit,
  // since orders has no dedicated column for it.
  const [khoroo, setKhoroo] = React.useState<number | null>(null);
  // A ref, not state: we re-submit from the modal's click handler and the flag
  // has to be visible to onSubmit in that same tick.
  const guestWarned = React.useRef(false);
  const [showGuestWarning, setShowGuestWarning] = React.useState(false);
  // Купоны бүх логик (санал болгох, дахин шалгах) нэг hook дотор.
  const {
    discount,
    offers,
    code,
    setCode,
    apply: applyCoupon,
    applying,
    offersLoading,
    message: couponMsg,
    pick: pickCoupon,
    clear: clearCoupon,
  } = useCoupon(subtotal, { enabled: mounted });

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

  /**
   * Fills the form from a saved address.
   *
   * Хүлээн авагчийн нэр, утсыг зөвхөн хэрэглэгч өөрөө хаяг сонгоход бөглөнө:
   * хуудас нээгдэхэд үндсэн хаягийн хүн автоматаар бичигдчихвэл өөр хүнд
   * хүргүүлэх захиалга дээр хэн ч тэр хоёр талбарыг хянаж үздэггүй.
   */
  const applyAddress = React.useCallback(
    (a: AddressRow, { contact = true }: { contact?: boolean } = {}) => {
      if (contact) {
        setValue("contactName", a.recipient);
        setValue("contactPhone", a.phone);
      }
      setValue("shipCity", a.city);
      setValue("shipDistrict", a.district ?? "");
      setValue("shipDetail", a.detail);
      setKhoroo(null); // detail already carries the khoroo text
    },
    [setValue],
  );

  // Сонгож болох хүргэлтийн өдрүүд. Mount-ийн дараа бодогдоно: сервер ба
  // браузарын өдөр зөрвөл (шөнө дунд, өөр цагийн бүс) hydration зөрчилдөнө.
  const [deliveryDays, setDeliveryDays] = React.useState<string[]>([]);
  React.useEffect(() => {
    const days = Array.from({ length: MAX_PREORDER_DAYS }, (_, i) =>
      ubDayFromNow(i + 1),
    );
    setDeliveryDays(days);
    setValue("deliverOn", days[0]);
  }, [setValue]);

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
    })();
  }, [setValue]);

  // begin_checkout fires once per visit to this page (todo №25).
  const checkoutTracked = React.useRef(false);
  React.useEffect(() => {
    if (checkoutTracked.current || !mounted) return;
    const { items: cartItems, collections: cartCols } = getSelectedLines();
    if (cartItems.length === 0 && cartCols.length === 0) return;
    checkoutTracked.current = true;
    trackBeginCheckout(
      [
        ...cartItems.map((i) => ({
          id: i.productId,
          name: `${i.name} ${i.ml}ml`,
          brand: i.brand,
          price: i.unitPrice,
          quantity: i.qty,
        })),
        ...cartCols.map((c) => ({
          id: c.collectionId ?? c.slug,
          name: c.name,
          price: c.unitPrice,
          quantity: c.qty,
        })),
      ],
      selectSubtotal(useCart.getState()),
    );
  }, [mounted]);

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
            .select("loyalty_points")
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
      // Хүлээн авагчийн нэр, утас, имэйлийг дансны мэдээллээр бөглөхгүй:
      // талбарууд хоосон эхэлж, захиалга бүрт хэн хүлээж авахыг ил бичнэ.
      const p = profile as { loyalty_points?: number } | null;
      setLoyaltyPoints(p?.loyalty_points ?? 0);
      const rows = (addrs as AddressRow[] | null) ?? [];
      setAddresses(rows);
      // The query orders `is_default` first, so the head of the list is the
      // address to start on — a returning customer should not have to choose
      // the same one every time.
      if (rows[0]) {
        setAddressChoice(rows[0].id);
        applyAddress(rows[0], { contact: false });
      }
      const rate = (setting as { value?: { redeemRate?: number } } | null)
        ?.value?.redeemRate;
      if (rate) setRedeemRate(rate);
    })();
  }, [setValue, applyAddress]);

  const zone = watch("shipZone");
  const city = watch("shipCity");
  const detail = watch("shipDetail");
  const district = watch("shipDistrict");

  // Бүсийг хэрэглэгч сонгохоо больсон: хаягаа сонгомогц админы бүсийн
  // хүснэгтээс (B5b) бүс, түүнтэй хамт хүргэлтийн үнэ өөрөө тодорхойлогдоно.
  // Сервер яг ижил дүрмээр дахин бодох тул энэ нь зөвхөн харагдах үнийг зөв
  // байлгах — хэрэглэгч хямд бүс «сонгох» боломж байхгүй.
  const autoZone = React.useMemo(
    () => resolveZone(zones, { city, district, khoroo }),
    [zones, city, district, khoroo],
  );
  React.useEffect(() => {
    // Дүрэм таарахгүй хаяг (админ бүсээ бүрэн зураагүй) бол хүргэдэг бүсийн
    // эхнийхээр үнэлнэ — сервер ч ийм тохиолдолд ингэж бодно.
    const fallback = zones.find((z) => z.deliverable !== false) ?? zones[0];
    const next = autoZone ?? (fallback ? zoneKey(fallback) : null);
    if (next) setValue("shipZone", next);
  }, [autoZone, zones, setValue]);
  const selectedZone = zones.find((z) => zoneKey(z) === zone) ?? zones[0];
  const zoneBlocked = selectedZone ? !selectedZone.deliverable : false;
  /** Хаяг бүрэн эсэх — бүс, хүргэлтийн үнэ зөвхөн үүний дараа гарна. */
  const hasAddress = Boolean(city && district && detail);
  /** Хаягийн блокийн доор гарах цорын нэг мессеж (талбарууд popup дотор). */
  const addressError =
    errors.shipCity?.message ??
    errors.shipDistrict?.message ??
    errors.shipDetail?.message ??
    errors.shipZone?.message ??
    null;
  // Every order pays its delivery fee (client rule — no free-shipping tier).
  const shippingFee = zoneBlocked || !selectedZone ? 0 : selectedZone.fee;

  // Points cover the goods only — never the delivery fee (questions.md №9).
  const maxLoyalty = Math.min(
    Math.floor(loyaltyPoints * redeemRate),
    Math.max(subtotal - discount, 0),
  );
  // Бэлгийн 1мл дээж: купоны дараах барааны дүнгийн 200,000₮ тутамд 1, эсвэл
  // preset 5/10/20мл багц бүрийн баталгаа — ихийг нь (src/lib/gift.ts).
  const giftAllowance = giftAllowanceFor(
    Math.max(subtotal - discount, 0),
    giftGuaranteeFor(collections),
  );
  // Бэлгийн сан — сагс, багцын дэлгэрэнгүйтэй ижил цорын ганц эх сурвалж
  // (backlog A2). Сан унтраалттай / хоосон бол доорх тоймд «🎁» гэж
  // амлахгүй: `GiftSamplePicker` өөрөө нуугддаг тул тэмдэг нь хэзээ ч
  // сонгох боломжгүй бэлгийг зааж байх ёсгүй. Модуль дотор кэштэй hook тул
  // нэмэлт хүсэлт гарахгүй, ачаалж амжаагүй үед `null` (тэмдэг гарахгүй).
  const giftPool = useGiftPool();
  const loyaltyApplied = useLoyalty ? maxLoyalty : 0;
  const total = Math.max(subtotal + shippingFee - discount - loyaltyApplied, 0);

  /** Popup-аас гарсан хаягийг формд тавиад сонгогдсон болгоно. */
  function applyDraft(form: AddressFormValue) {
    setDraft(form);
    setAddressChoice(NEW_ADDRESS);
    setValue("shipCity", form.city);
    setValue("shipDistrict", form.district);
    setValue("shipDetail", form.detail);
    setKhoroo(form.khoroo);
  }

  function onAddressChoice(next: string) {
    if (next === NEW_ADDRESS) {
      // Оруулсан хаяг байхгүй бол сонгох юм ч байхгүй — popup нээнэ.
      if (!draft) {
        setAddressOpen(true);
        return;
      }
      setAddressChoice(NEW_ADDRESS);
      applyDraft(draft);
      return;
    }
    setAddressChoice(next);
    const a = addresses.find((x) => x.id === next);
    if (a) applyAddress(a);
  }

  // Төлбөрийн хуудас руу шилжиж байхад сагс аль хэдийн хоосорсон байдаг тул
  // хоосон төлөвийн оронд шилжиж байгааг харуулна.
  if (leaving) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-28 text-center md:px-8">
        <Loader2 className="text-muted-foreground size-7 animate-spin" />
        <p className="text-muted-foreground text-sm">
          Төлбөрийн хуудас руу шилжиж байна…
        </p>
      </div>
    );
  }

  if (mounted && items.length === 0 && collections.length === 0) {
    // Сагс дүүрэн байж болно — зүгээр л нэг ч мөр сонгоогүй байх.
    const nothingSelected = cartLineCount > 0;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-28 text-center md:px-8">
        <span className="bg-secondary flex size-16 items-center justify-center rounded-full">
          <ShoppingCart className="text-muted-foreground size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold">
            {nothingSelected ? "Бараа сонгогдоогүй" : "Сагс хоосон байна"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {nothingSelected
              ? "Сагснаасаа захиалах барааг чагтлаад дахин үргэлжлүүлнэ үү."
              : "Захиалга өгөхийн тулд эхлээд бараа нэмнэ үү."}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={nothingSelected ? "/cart" : "/catalog"}>
            {nothingSelected ? "Сагс руу буцах" : "Бараа үзэх"}
          </Link>
        </Button>
      </div>
    );
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
          deliverOn: values.deliverOn,
          loyaltyUsed: loyaltyApplied,
          saveAddress: saveAddr,
          giftProductIds: giftIds,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            ml: i.ml,
            qty: i.qty,
          })),
          collections: collections.map((c) => ({
            collectionId: c.collectionId,
            type: c.type,
            ml: c.ml,
            qty: c.qty,
            memberVariantIds: c.members.map((m) => m.variantId),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // A cart lives in localStorage and can outlive the catalogue. The
        // server refuses the order rather than quietly charging for whatever
        // survived, and the dead lines come back by variant id (the cart's
        // line key) so they can be cleared here.
        if (data.error === "ITEMS_UNAVAILABLE") {
          const ids: string[] = Array.isArray(data.variantIds)
            ? data.variantIds
            : [];
          for (const id of ids) removeLine(id);
          setServerError(
            ids.length > 0
              ? "Сагсан дахь зарим бараа худалдаанаас хасагдсан тул сагснаас чинь хаслаа. Үлдсэн барааг шалгаад дахин үргэлжлүүлнэ үү."
              : "Сагсан дахь бараа худалдаанд байхгүй болжээ. Сагсаа шинэчилнэ үү.",
          );
          return;
        }
        setServerError(
          data.error === "EMPTY_CART"
            ? "Сагс хоосон байна — бараагаа дахин нэмнэ үү."
            : data.error === "OUT_OF_STOCK"
              ? "Уучлаарай, зарим бараа дууссан байна."
              : data.error === "BUNDLE_UNAVAILABLE"
                ? "Сагсан дахь багц худалдаанд байхгүй болсон байна. Багцаа шинэчилнэ үү."
                : data.error === "ZONE_UNAVAILABLE"
                  ? "Сонгосон бүсэд хүргэлт хийх боломжгүй байна."
                  : "Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.",
        );
        return;
      }
      const order = await res.json();
      // Захиалга үүссэн — эндээс хойш хуудас зөвхөн шилжих төлөвт байна.
      setLeaving(true);
      // Зөвхөн захиалагдсан (сонгосон) мөрүүд сагснаас хасагдана.
      removeOrdered();
      // The payment page is server-rendered from `pay_token`, so nothing about
      // the order rides in sessionStorage any more: the link survives a reload,
      // a new tab, and being opened on the customer's phone.
      if (order.payToken) {
        router.push(`/pay/${order.payToken}`);
        return;
      }
      // Demo mode (no database) issues no token — there is nothing to pay.
      sessionStorage.setItem(
        "vonscent-last-order",
        JSON.stringify({
          orderNo: order.orderNo,
          total: order.total,
          paymentMethod: order.paymentMethod,
          contactName: values.contactName,
          deliverOn: values.deliverOn ?? null,
        }),
      );
      router.push("/order/success");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-352 px-4 py-8 md:px-8">
      {/* «Сагс руу буцах» линк байхгүй: сагс нь толгойн навигацид ямагт
          байдаг, харин захиалгын хуудсын толгойд гарц тавих нь эндээс гарах
          сонголтыг хамгийн түрүүнд уншуулна. */}
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight">
        Захиалга өгөх
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-10"
      >
        <div className="space-y-6">
          {/* Guest prompt: register to earn loyalty points */}
          {mounted && !authed && (
            <div className="bg-secondary rounded-2xl px-4 py-3.5 text-sm">
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

          {/* Хүргэлтийн хаяг — хадгалсан хаягууд + popup-аар нэмсэн шинэ хаяг */}
          <Section step={1} icon={MapPin} title="Хүргэлтийн хаяг">
            <SavedAddresses
              addresses={authed ? addresses : []}
              value={addressChoice}
              onChange={onAddressChoice}
              draft={draft}
              onAddNew={() => setAddressOpen(true)}
            />

            {addressError && (
              <p className="text-destructive text-xs">{addressError}</p>
            )}

            {authed && draft && addressChoice === NEW_ADDRESS && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={saveAddr}
                  onCheckedChange={(v) => setSaveAddr(Boolean(v))}
                />
                Энэ хаягийг хадгалах
              </label>
            )}

            {/* Бүс сонгох талбар байхаа больсон — хаягаас гарсан бүс, үнийг л
                харуулна. */}
            {hasAddress && selectedZone && (
              <div className="bg-secondary flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="size-4" />
                  Хүргэлт · {selectedZone.name}
                </span>
                <span className="font-medium">
                  {zoneBlocked ? "хүргэлтгүй" : formatPrice(selectedZone.fee)}
                </span>
              </div>
            )}

            {deliveryDays.length > 0 && (
              <Field label="Хүргүүлэх өдөр" error={errors.deliverOn?.message}>
                <Select
                  value={watch("deliverOn") ?? deliveryDays[0]}
                  onValueChange={(v) => setValue("deliverOn", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryDays.map((day) => (
                      <SelectItem key={day} value={day}>
                        {formatDeliveryDay(day)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Хамгийн эрт нь маргааш — бэлдэхэд нэг өдөр хэрэгтэй. Сонгосон
                  өдрийнхөө {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.
                </p>
              </Field>
            )}

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
          </Section>

          {/* Хүлээн авагч — талбарууд зориуд хоосон эхэлнэ (дансны нэр, утсаар
              бөглөхгүй), хаяг сонгоход л бөглөгдөнө. */}
          <Section step={2} icon={User} title="Хүлээн авагчийн мэдээлэл">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Нэр" error={errors.contactName?.message}>
                <Input
                  {...register("contactName")}
                  placeholder="Хүлээн авах хүний нэр"
                />
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

          {/* Бэлгийн 1мл дээж — эрхийн тоогоор, зөвхөн админы сангаас. */}
          {mounted && (
            <GiftSamplePicker
              allowance={giftAllowance}
              value={giftIds}
              onChange={setGiftIds}
            />
          )}
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
                  collections.map((c) => (
                    <div key={c.key} className="flex items-center gap-3">
                      {/* Тоо ширхгийн тэмдэг зургийн хүрээний *гадна* байх
                          ёстой: `overflow-hidden` дотор байхдаа хагас
                          хайчлагдаж, зураг дээр хар зэрэг шиг харагддаг. */}
                      <div className="relative size-14 shrink-0">
                        <div className="bg-muted size-full overflow-hidden rounded-xl">
                          {c.image && (
                            <Image
                              src={c.image}
                              alt={c.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                          {c.qty}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm/tight font-medium">
                          {c.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Багц · {c.ml}ml · {c.members.length} үнэртэн
                          {giftPool?.enabled && bundleGiftGuarantee(c) > 0
                            ? " · 🎁"
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPrice(c.unitPrice * c.qty)}
                      </span>
                    </div>
                  ))}
                {mounted &&
                  items.map((i) => (
                    <div key={i.key} className="flex items-center gap-3">
                      {/* Тоо ширхгийн тэмдэг зургийн хүрээний *гадна* байх
                          ёстой: `overflow-hidden` дотор байхдаа хагас
                          хайчлагдаж, зураг дээр хар зэрэг шиг харагддаг. */}
                      <div className="relative size-14 shrink-0">
                        <div className="bg-muted size-full overflow-hidden rounded-xl">
                          {i.image && (
                            <Image
                              src={i.image}
                              alt={i.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                          {i.qty}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm/tight font-medium">
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
              <CouponField
                applied={coupon}
                offers={offers}
                code={code}
                onCodeChange={setCode}
                onApply={applyCoupon}
                applying={applying}
                loading={offersLoading}
                message={couponMsg}
                onPick={pickCoupon}
                onRemove={clearCoupon}
              />

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Барааны дүн</span>
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
                    {shippingFee === 0 ? "—" : formatPrice(shippingFee)}
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

              {/* Dispatch cut-off reminder (questions.md №14). */}
              {mounted && (
                <p className="bg-secondary rounded-xl px-3 py-2.5 text-xs/relaxed">
                  <Clock className="mr-1 inline size-3.5 align-[-2px]" />
                  {`Захиалга ${formatDeliveryDay(
                    watch("deliverOn") ?? deliveryDays[0] ?? "",
                  ).toLowerCase()} ${DISPATCH_HOUR}:00 цагт хүргэлтэд гарна (амралтын өдөр ч хүргэнэ).`}{" "}
                  Тэр өдрийн өглөөний{" "}
                  <strong>{ORDER_EDIT_CUTOFF_HOUR}:00</strong> цагаас хойш
                  захиалга цуцлах, өөрчлөх боломжгүй.
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
                Аюулгүй төлбөр · QPay
              </p>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Шинэ хаяг — popup. Хуудсан дээр форм нээхээ больсон. */}
      <AddressDialog
        open={addressOpen}
        onOpenChange={setAddressOpen}
        initial={draft ?? undefined}
        submitLabel="Хаяг хэрэглэх"
        onSave={applyDraft}
      />

      {/* Guest consent: V point is forfeited unless they register first. */}
      {showGuestWarning && (
        <div className="bg-foreground/40 fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm space-y-4 rounded-2xl p-6 text-center shadow-xl">
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
    <section className="bg-card scroll-mt-24 rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
          {step > 0 ? (
            <span className="text-sm font-semibold">{step}</span>
          ) : (
            <Icon className="size-4.5" />
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
