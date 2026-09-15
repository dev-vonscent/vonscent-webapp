"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Truck, ShieldCheck, ShoppingCart, Clock, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { FieldError } from "@/components/ui/form-field";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
import { useClaimBottomBar } from "@/components/shared/bottom-nav-store";
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
import { LoyaltyField } from "@/features/checkout/components/loyalty-field";
import { useCoupon } from "@/features/checkout/use-coupon";
import { formatPrice } from "@/lib/format";
import {
  DEFAULT_LOYALTY_RULES,
  parseLoyaltyRules,
  pointsEarnedFor,
} from "@/lib/loyalty";
import { useCart, selectCheckoutSubtotal } from "@/features/cart/store";
import {
  useCheckoutLines,
  getCheckoutLines,
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

/**
 * Бүртгүүлэх / нэвтрэх рүү явахад бөглөсөн зүйл нь алга болохгүй байх түлхүүр.
 *
 * Энэ хуудсын төлөв бүхэлдээ React state — «Бүртгүүлэх» дарахад хүлээн авагч,
 * утас, хаягийн ноорог, хүргэх өдөр, тэмдэглэл, бэлгийн сонголт бүгд устдаг
 * байв. `?next=/checkout`-оор буцаж ирэхэд тэднийг эргүүлж тавина.
 */
const DRAFT_KEY = "vonscent-checkout-draft";

interface CheckoutDraft {
  values: Partial<FormValues>;
  khoroo: number | null;
  address: AddressFormValue | null;
  noteTags: string[];
  giftIds: string[];
}

/** Бөглөсөн хэсгийг хадгална — `?next=`-ээр буцаж ирэхэд л уншигдана. */
function saveDraft(draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / хориглосон storage — ноорог алга болно, урсгал таслахгүй.
  }
}

/** Ноорогийг нэг л удаа уншина: буцаад авсны дараа шууд устгана. */
function takeDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) as CheckoutDraft;
  } catch {
    return null;
  }
}

/**
 * `?next=` нь баталгаажуулалтын формд аль хэдийн байдаг (phone-auth-form) —
 * checkout нь түүнийг ашигладаггүй байсан тул бүртгүүлэх рүү явсан хүн
 * буцаж ирэх замгүй /-д хаягддаг байв.
 */
const REGISTER_HREF = "/register?next=%2Fcheckout";

/**
 * Алдаатай талбар аль хэсэгт байгаа вэ. Утсан дээр товч нь 4 дэлгэцийн доор
 * байдаг тул «дарсан ч юу ч болохгүй» гэсэн мэдрэмжийг зөвхөн энэ зураглал
 * дээр суурилсан гүйлгэлт л арилгана (`Section` дээрх `scroll-mt-24`).
 */
const SECTION_ORDER = ["checkout-address", "checkout-recipient"] as const;

const ERROR_SECTION: Record<string, string> = {
  shipCity: "checkout-address",
  shipDistrict: "checkout-address",
  shipDetail: "checkout-address",
  shipZone: "checkout-address",
  deliverOn: "checkout-address",
  note: "checkout-address",
  contactName: "checkout-recipient",
  contactPhone: "checkout-recipient",
  contactEmail: "checkout-recipient",
};

export default function CheckoutPage() {
  const router = useRouter();
  // Захиалга сагснаас *сонгосон* мөрүүдийг л авна — сонгоогүй бараа сагсандаа
  // үлдэж, дараа нь тусад нь захиалагдана.
  const { items, collections, buyNow } = useCheckoutLines();
  const cartLineCount = useCart((s) => s.items.length + s.collections.length);
  const subtotal = useCart(selectCheckoutSubtotal);
  const coupon = useCart((s) => s.coupon);
  const removeOrdered = useCart((s) => s.clearOrdered);
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
  const [loyaltyRules, setLoyaltyRules] = React.useState(DEFAULT_LOYALTY_RULES);
  /**
   * Оноогоор төлөхөөр хэрэглэгчийн ӨӨРӨӨ бичсэн дүн (₮). Өмнө нь энэ нь
   * чагт байсан тул «бүгд эсвэл юу ч үгүй» гэсэн хоёрхон сонголттой байв.
   */
  const [loyaltyWanted, setLoyaltyWanted] = React.useState(0);
  const [saveAddr, setSaveAddr] = React.useState(false);
  // Zones come from admin settings (A10); the constants are only a fallback
  // for demo mode / while the settings row loads.
  const [zones, setZones] = React.useState<ShippingZoneConfig[]>([
    ...SHIPPING_ZONES,
  ]);
  /** Дэлгүүрийн утас — хүргэлтгүй бүсэд гарах бодит гарц (админы тохиргоо). */
  const [storePhone, setStorePhone] = React.useState<string | null>(null);
  const [noteTags, setNoteTags] = React.useState<string[]>([]);
  const [giftIds, setGiftIds] = React.useState<string[]>([]);
  // Khoroo lives outside the form: it is folded into shipDetail on submit,
  // since orders has no dedicated column for it.
  const [khoroo, setKhoroo] = React.useState<number | null>(null);
  // A ref, not state: we re-submit from the modal's click handler and the flag
  // has to be visible to onSubmit in that same tick.
  const guestWarned = React.useRef(false);
  const [showGuestWarning, setShowGuestWarning] = React.useState(false);
  // Бэлгийн эрхээ ашиглаагүйг нэг л удаа асууна: үнэгүй дээжийн төлөө
  // худалдан авалтыг хаах нь буруу, харин дуугүй өнгөрөөх нь ч буруу.
  const giftWarned = React.useRef(false);
  const [showGiftWarning, setShowGiftWarning] = React.useState(false);
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
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    // Өөрсдөө фокуслана: RHF-ийн автомат фокус нь бүртгэгдсэн ЭХНИЙ талбар руу
    // (Нэр) үсэрч, хаягийн алдааг давж гардаг — хаягийн талбарууд popup дотор
    // байдаг тул RHF тэднийг «байхгүй» гэж үзнэ.
    shouldFocusError: false,
    defaultValues: {
      shipCity: "",
      shipZone: SHIPPING_ZONES[0].code,
      paymentMethod: "qpay",
    },
  });

  /**
   * Форм буруу бол эхний алдаатай хэсэг рүү гүйлгэнэ.
   *
   * react-hook-form-ийн өөрийнх нь `shouldFocusError` энд ажиллахгүй: хаягийн
   * талбарууд `register`-дээгүй (popup дотор амьдардаг, `setValue`-ээр
   * бичигддэг) тул фокуслах ref байхгүй. Утсан дээр товч нь хуудасны ёроолд
   * байдаг учир ямар нэг харагдах хариу үйлдэлгүй бол дарсан хүн энэ товчийг
   * эвдэрсэн гэж үзнэ.
   */
  const onInvalid = React.useCallback((formErrors: Record<string, unknown>) => {
    // Хамгийн ДЭЭД талын алдаатай хэсэг рүү, resolver-ийн түлхүүрийн
    // дарааллаар биш: хэрэглэгч хуудсыг дээрээс доош уншдаг, схемийн
    // дарааллаар биш.
    const ids = new Set(
      Object.keys(formErrors)
        .map((key) => ERROR_SECTION[key])
        .filter(Boolean),
    );
    const target = SECTION_ORDER.find((id) => ids.has(id));
    if (!target) return;
    const section = document.getElementById(target);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Хэсэг дотроо бичих талбартай бол түүнийг фокуслана (гар утсан дээр
    // гар нь дараагийн алхмыг өөрөө хэлнэ). `preventScroll` — эс тэгвээс
    // браузар дөнгөж эхэлсэн гүйлгэлтийг таслана.
    section
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus({ preventScroll: true });
  }, []);

  /** Наалдсан төлбөрийн зурвас гарах эсэх — хоосон / шилжих төлөвт гарахгүй. */
  const showPayBar =
    mounted && !leaving && (items.length > 0 || collections.length > 0);
  // Зурвас доод цэсний ОРОНД суудаг — хоёулаа зэрэг хөвж, дэлгэцийн 17%-ийг
  // эзлэхээс сэргийлнэ. Зурвас байхгүй үед цэс эргэж гарна.
  useClaimBottomBar(showPayBar);

  /** Бүртгэл рүү явахын өмнө бөглөсөн бүхнээ хадгална. */
  const keepDraft = React.useCallback(() => {
    saveDraft({
      values: getValues(),
      khoroo,
      address: draft,
      noteTags,
      giftIds,
    });
  }, [getValues, khoroo, draft, noteTags, giftIds]);

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

  // Бүртгүүлэх/нэвтрэх рүү явчихаад буцаж ирсэн бол бөглөсөн зүйлээ эргүүлж
  // авна. Нэг л удаа уншигдана (`takeDraft` уншаад устгана) тул дараагийн
  // цэвэр захиалга хуучин хүний нэрээр эхлэхгүй.
  React.useEffect(() => {
    const saved = takeDraft();
    if (!saved) return;
    for (const [key, value] of Object.entries(saved.values)) {
      if (value != null && value !== "") {
        setValue(key as keyof FormValues, value as never);
      }
    }
    setKhoroo(saved.khoroo);
    setNoteTags(saved.noteTags);
    setGiftIds(saved.giftIds);
    if (saved.address) {
      setDraft(saved.address);
      setAddressChoice(NEW_ADDRESS);
    }
  }, [setValue]);

  // Сонгож болох хүргэлтийн өдрүүд. Mount-ийн дараа бодогдоно: сервер ба
  // браузарын өдөр зөрвөл (шөнө дунд, өөр цагийн бүс) hydration зөрчилдөнө.
  const [deliveryDays, setDeliveryDays] = React.useState<string[]>([]);
  React.useEffect(() => {
    const days = Array.from({ length: MAX_PREORDER_DAYS }, (_, i) =>
      ubDayFromNow(i + 1),
    );
    setDeliveryDays(days);
    // Ноорогоос сэргээсэн өдрийг дарж бичихгүй.
    if (!getValues("deliverOn")) setValue("deliverOn", days[0]);
  }, [setValue, getValues]);

  // Delivery zones + free-shipping threshold are admin-configurable (A10).
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    (async () => {
      const [{ data }, { data: storeRow }] = await Promise.all([
        supabase
          .from("settings")
          .select("value")
          .eq("key", "shipping")
          .maybeSingle(),
        supabase
          .from("settings")
          .select("value")
          .eq("key", "store")
          .maybeSingle(),
      ]);
      const phone = (storeRow as { value?: { phone?: string } } | null)?.value
        ?.phone;
      if (phone) setStorePhone(phone);
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
    const { items: cartItems, collections: cartCols } = getCheckoutLines();
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
      selectCheckoutSubtotal(useCart.getState()),
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
      setLoyaltyRules(
        parseLoyaltyRules((setting as { value?: unknown } | null)?.value),
      );
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
  /** Алслагдсан бүс — хаяг тодорсны дараа л мэдэгдэнэ. */
  const remoteZone = Boolean(
    hasAddress && selectedZone?.remote && !zoneBlocked,
  );
  /** Хаягийн блокийн доор гарах цорын нэг мессеж (талбарууд popup дотор). */
  const addressError =
    errors.shipCity?.message ??
    errors.shipDistrict?.message ??
    errors.shipDetail?.message ??
    errors.shipZone?.message ??
    null;
  /**
   * Хүргэлтийн төлбөр — ЗӨВХӨН хаяг бүрэн болсны дараа.
   *
   * Өмнө нь хаяг оруулаагүй байхад ч «хүргэдэг эхний бүс»-ийн үнээр тоо гарч,
   * бүтэн «Нийт төлөх» харагддаг байв — тэгээд орон нутгийн хаяг ороход тоо нь
   * үсэрдэг. Хэрэглэгчийн хүрэлгүйгээр өөрчлөгдсөн дүн бол захиалгын явцад
   * итгэл алдагдуулах хамгийн хүчтэй зөрүү; сагсны хуудас яг үүнээс болж
   * хүргэлтээ «Хаягаас хамаарна» гэдэг (cart/page.tsx). Энэ хуудас түүнтэй
   * нэг үг хэлнэ. Үнэгүй хүргэлтийн шатлал байхгүй тул тэр салаа ч байхгүй.
   */
  const shippingFee =
    !hasAddress || zoneBlocked || !selectedZone ? 0 : selectedZone.fee;

  // Points cover the goods only — never the delivery fee (questions.md №9).
  const maxLoyalty = Math.min(
    Math.floor(loyaltyPoints * loyaltyRules.redeemRate),
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
  // Сагс, купон өөрчлөгдөхөд дээд хязгаар буурч болно — бичсэн дүнг ямагт
  // түүнд хумина, эс тэгвээс хуудас сервер хүлээж авахгүй дүн харуулна.
  const loyaltyApplied = Math.min(loyaltyWanted, maxLoyalty);
  const total = Math.max(subtotal + shippingFee - discount - loyaltyApplied, 0);
  /**
   * Энэ захиалгаас хуримтлагдах оноо. Сан нь купоны дараах барааны дүнгээс
   * бодох тул оноогоор төлсөн хэсэг үүнийг бууруулахгүй (lib/loyalty.ts).
   */
  const pointsEarned = pointsEarnedFor(
    Math.max(subtotal - discount, 0),
    loyaltyRules,
  );

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
    // Сагс дүүрэн байж болно — зүгээр л нэг ч мөр сонгоогүй байх. «Захиалах»
    // замаар ирсэн бол сагсны агуулга хамаагүй тул энэ зөвлөмж буруу болно.
    const nothingSelected = !buyNow && cartLineCount > 0;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-28 text-center md:px-8">
        <span className="bg-secondary flex size-16 items-center justify-center rounded-full">
          <ShoppingCart className="text-muted-foreground size-7" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
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
      setServerError("Энэ хаяг руу хүргэлт хийдэггүй. Өөр хаяг оруулна уу.");
      return;
    }
    // Унаа явах газар нь орон нутгийн захиалгын хүргэх хаягтай адил чухал —
    // бичигдээгүй бол захиалга үүсгэхийн оронд талбар руу нь буцаана.
    if (remoteZone && !(values.note ?? "").trim()) {
      setError("note", {
        message: "Ачаа очих унаа, буудлын нэрийг бичнэ үү.",
      });
      onInvalid({ note: true });
      return;
    }
    // Guests get one explicit heads-up that they forfeit V point before we
    // take their money (requirement_fb.md §5).
    if (!authed && !guestWarned.current) {
      setShowGuestWarning(true);
      return;
    }

    // Эрхтэй атлаа нэг ч дээж сонгоогүй бол нэг удаа сануулна — 600,000₮-ийн
    // захиалга гурван үнэгүй дээжээ орхиод төлбөр рүү орох ёсгүй.
    if (giftAllowance > 0 && giftIds.length === 0 && !giftWarned.current) {
      setShowGiftWarning(true);
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
        if (res.status === 429) {
          setServerError(
            data.message ??
              "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.",
          );
          return;
        }
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
        router.replace(`/pay/${order.payToken}`);
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
      router.replace("/order/success");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-352 px-4 pt-8 md:px-8 md:pb-24 lg:pb-8">
      {/* «Сагс руу буцах» линк байхгүй: сагс нь толгойн навигацид ямагт
          байдаг, харин захиалгын хуудсын толгойд гарц тавих нь эндээс гарах
          сонголтыг хамгийн түрүүнд уншуулна. */}
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Захиалга өгөх
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-10"
      >
        <div className="space-y-6">
          {/* Guest prompt: register to earn loyalty points */}
          {mounted && !authed && (
            <div className="bg-secondary rounded-2xl px-4 py-3.5 text-sm">
              <p>
                <Link
                  href={REGISTER_HREF}
                  onClick={keepDraft}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Бүртгүүлээд
                </Link>{" "}
                {pointsEarned > 0 ? (
                  <>
                    энэ захиалгаас{" "}
                    <strong className="tabular-nums">
                      {pointsEarned.toLocaleString("mn-MN")} V point
                    </strong>{" "}
                    цуглуулаарай.
                  </>
                ) : (
                  "захиалга бүртээ V point цуглуулаарай."
                )}{" "}
                Зочноор захиалга хийвэл оноо хуримтлуулахгүй.
              </p>
            </div>
          )}

          {/* Хүргэлтийн хаяг — хадгалсан хаягууд + popup-аар нэмсэн шинэ хаяг */}
          <Section id="checkout-address" step={1} title="Хүргэлтийн хаяг">
            <SavedAddresses
              addresses={authed ? addresses : []}
              value={addressChoice}
              onChange={onAddressChoice}
              draft={draft}
              onAddNew={() => setAddressOpen(true)}
            />

            {/* Хаягийн талбарууд popup дотор амьдардаг тул алдаа нь энд —
                `role="alert"`-тай, дэлгэц уншигчид зарлагдана. */}
            <FieldError
              id="checkout-address"
              message={addressError ?? undefined}
            />

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
              <Field
                label="Хүргүүлэх өдөр"
                error={errors.deliverOn?.message}
                hint={`Хамгийн эрт нь маргааш — бэлдэхэд нэг өдөр хэрэгтэй. Сонгосон өдрийнхөө ${DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.`}
              >
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
              </Field>
            )}

            {/* Бүс сонгох хяналт устсан тул «өөр бүс сонго» гэж хэлэх газар
                байхгүй — гарц нь өөр хаяг оруулах, эсвэл залгах хоёр л. */}
            {zoneBlocked && (
              <div className="bg-destructive/10 space-y-2.5 rounded-xl px-3 py-2.5 text-sm">
                <p className="text-destructive">
                  Уучлаарай, энэ хаяг руу хүргэлт хийдэггүй.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAddressOpen(true)}
                  >
                    Өөр хаяг оруулах
                  </Button>
                  {storePhone && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={`tel:${storePhone}`}>{storePhone} руу залгах</a>
                    </Button>
                  )}
                </div>
              </div>
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

            {/* Орон нутагт ачаа унаагаар явдаг тул «унаа явах газар» нь
                заавал: өмнө нь үүнийг «(заавал биш)» гэж шошголсон талбарт
                шаарддаг байсан — шалгалтгүй, зөрчилтэй. Одоо бүс нь алслагдсан
                үед энэ талбар нэр, шаардлагаа хоёуланг нь солино. */}
            <Field
              label={
                remoteZone ? "Унаа явах газар" : "Нэмэлт тэмдэглэл (заавал биш)"
              }
              error={errors.note?.message}
              hint={
                remoteZone
                  ? "Орон нутгийн унаа хөдлөх буудал, терминалын нэрийг бичнэ үү."
                  : undefined
              }
            >
              <Input
                {...register("note")}
                placeholder={
                  remoteZone
                    ? "Жишээ: Драгон терминал, Дархан чиглэл"
                    : "Жишээ: оройн цагаар залгаарай"
                }
              />
            </Field>
          </Section>

          {/* Хүлээн авагч — талбарууд зориуд хоосон эхэлнэ (дансны нэр, утсаар
              бөглөхгүй), хаяг сонгоход л бөглөгдөнө. */}
          <Section
            id="checkout-recipient"
            step={2}
            title="Хүлээн авагчийн мэдээлэл"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* `autoComplete` нь утсан дээрх хамгийн том хэмнэлт: Chrome-ийн
                  автобөглөлт энэ гурван талбарыг нэг товшилтоор дүүргэдэг.
                  Нэрийг `name` биш `shipping name` гэж тэмдэглэв — хүлээн
                  авагч нь захиалагч өөрөө байх албагүй (бэлэг). */}
              <Field label="Нэр" error={errors.contactName?.message}>
                <Input
                  {...register("contactName")}
                  placeholder="Хүлээн авах хүний нэр"
                  autoComplete="shipping name"
                />
              </Field>
              <Field label="Утас" error={errors.contactPhone?.message}>
                <Input
                  {...register("contactPhone")}
                  placeholder="99112233"
                  type="tel"
                  inputMode="numeric"
                  // Монголын дугаар 8 орон — 11 оронтой (улсын код түрүүлсэн)
                  // дугаарыг илгээх хүртэл хүлээж байгаад буцаах нь хожуу.
                  maxLength={8}
                  autoComplete="shipping tel-national"
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
                type="email"
                autoComplete="email"
              />
            </Field>
          </Section>

          {/* Бэлгийн 1мл дээж — эрхийн тоогоор, зөвхөн админы сангаас. */}
          {mounted && (
            <div id="checkout-gift" className="scroll-mt-24">
              <GiftSamplePicker
                allowance={giftAllowance}
                goodsAfterDiscount={Math.max(subtotal - discount, 0)}
                value={giftIds}
                onChange={setGiftIds}
              />
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-6">
              <h2 className="text-lg font-semibold">Захиалгын тойм</h2>

              <div className="space-y-3">
                {mounted &&
                  collections.map((c) => (
                    <div key={c.key} className="flex items-center gap-3">
                      {/* Тоо ширхгийн тэмдэг зургийн хүрээний *гадна* байх
                          ёстой: `overflow-hidden` дотор байхдаа хагас
                          хайчлагдаж, зураг дээр хар зэрэг шиг харагддаг. */}
                      <div className="relative size-14 shrink-0">
                        <div className="bg-muted relative size-full overflow-hidden rounded-xl">
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
                        <div className="bg-muted relative size-full overflow-hidden rounded-xl">
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

              {/* Хямдруулах ХЭРЭГСЛҮҮД эхэлж, тооцооны мөрүүд дараа нь.
                  Өмнө нь оноо нь хүргэлт ба нийт дүнгийн ХООРОНД сууж
                  байсан тул дүн хэрхэн гарсныг дээрээс доош уншиж
                  болдоггүй байв. */}
              <div className="space-y-2.5">
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

                {mounted && authed && maxLoyalty > 0 && (
                  <LoyaltyField
                    value={loyaltyApplied}
                    onChange={setLoyaltyWanted}
                    max={maxLoyalty}
                    balance={loyaltyPoints}
                    redeemRate={loyaltyRules.redeemRate}
                  />
                )}
              </div>

              <div className="gold-rule" />

              {/* Тооцоо: хасагдах нь «−», хүргэлт нь «+». Тэмдэггүй багана
                  дээр 8,000₮ гэсэн тоо нэмэгдэж байна уу, хасагдаж байна уу
                  гэдэг зөвхөн шошгоноос таамаглагддаг байсан. */}
              <div className="space-y-2.5">
                <SummaryRow label="Барааны дүн" value={formatPrice(subtotal)} />
                {discount > 0 && (
                  <SummaryRow
                    label={
                      coupon?.code ? `Купон · ${coupon.code}` : "Хөнгөлөлт"
                    }
                    value={`−${formatPrice(discount)}`}
                    credit
                  />
                )}
                {loyaltyApplied > 0 && (
                  <SummaryRow
                    label="V point"
                    value={`−${formatPrice(loyaltyApplied)}`}
                    credit
                  />
                )}
                {/* Бэлэг нь тоймд ил мөр болж байж л «захиалгад юу орсон бэ»
                    гэдгийн хэсэг болно — эс тэгвээс хуудасны дунд сонгоод
                    мартчихдаг, хасагдсаныг нь ч мэдэхгүй өнгөрдөг. */}
                {giftIds.length > 0 && (
                  <SummaryRow
                    label={`Бэлэг · ${giftPool?.sampleMl ?? 1}мл дээж × ${giftIds.length}`}
                    value="Үнэгүй"
                    credit
                  />
                )}
                {/* Ашиглаагүй эрхийг тоймд хэлнэ: хэрэглэгч энэ багана дээр
                    дүнгээ шалгаж байхдаа л «би юу авах гэж байна» гэдгийг
                    эцэслэн уншдаг. */}
                {giftAllowance > giftIds.length && (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("checkout-gift")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="text-gold-strong flex w-full items-baseline justify-between gap-3 text-left text-sm underline-offset-4 hover:underline"
                  >
                    <span className="min-w-0">
                      Бэлгийн {giftAllowance - giftIds.length} дээж сонгоогүй
                      байна
                    </span>
                    <span className="shrink-0">Сонгох</span>
                  </button>
                )}
                {/* Тэмдэг нь энэ мөрийг ялгаж байгаа тул icon хэрэггүй:
                    бүх шошго нэг зүүн ирмэгээс эхэлсэн багана илүү тайван. */}
                <SummaryRow
                  label={
                    hasAddress && selectedZone
                      ? `Хүргэлт · ${selectedZone.name}`
                      : "Хүргэлт"
                  }
                  value={
                    !hasAddress
                      ? "Хаягаас хамаарна"
                      : zoneBlocked
                        ? "хүргэлтгүй"
                        : `+${formatPrice(shippingFee)}`
                  }
                />
              </div>

              <div className="gold-rule" />

              {/* Хаяг гарч ирэх хүртэл энэ тоо нь эцсийн дүн БИШ — шошго нь
                  түүнийг шууд хэлнэ, эс тэгвээс «Нийт төлөх» гэж уншсан дүн
                  дараа нь өсөх нь амласнаа зөрчсөнтэй адил. */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {hasAddress ? "Нийт төлөх" : "Хүргэлтгүй дүн"}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {formatPrice(total)}
                </span>
              </div>
              {!hasAddress && (
                <p className="text-muted-foreground text-xs">
                  Хаягаа оруулмагц хүргэлтийн төлбөр нэмэгдэж, эцсийн дүн гарна.
                </p>
              )}

              {/* Энэ худалдан авалт хэдэн оноо авчрах вэ. Зочинд ижил тоог
                  хуудасны толгой дахь бүртгэлийн санамж аль хэдийн хэлдэг тул
                  энд давтахгүй — тойм нь ЭНЭ захиалгын баримт байх ёстой. */}
              {mounted && authed && pointsEarned > 0 && (
                <p className="text-muted-foreground text-xs">
                  Энэ захиалгаас{" "}
                  <strong className="text-foreground font-medium tabular-nums">
                    +{pointsEarned.toLocaleString("mn-MN")} V point
                  </strong>{" "}
                  хуримтлагдана — хүргэгдсэний дараа зарцуулах боломжтой.
                </p>
              )}

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
                  )} ${DISPATCH_HOUR}:00 цагт хүргэлтэд гарна (амралтын өдөр ч хүргэнэ).`}{" "}
                  Тэр өдрийн өглөөний{" "}
                  <strong>{ORDER_EDIT_CUTOFF_HOUR}:00</strong> цагаас хойш
                  захиалга цуцлах, өөрчлөх боломжгүй.
                </p>
              )}

              {/* Товч нь захиалгыг БАТАЛГААЖУУЛДАГГҮЙ — төлөгдөөгүй захиалга
                  үүсгээд QPay рүү дамжуулна. «Захиалга баталгаажуулах» гэдэг нь
                  эндээс бүх зүйл дуусна гэсэн амлалт өгч байсан. */}
              {/* Утсан дээр энэ товчийг наалдсан зурвас орлоно — хоёулаа зэрэг
                  харагдвал нэг дэлгэц дээр ижил хоёр CTA болно. */}
              <Button
                type="submit"
                size="lg"
                className="hidden w-full lg:inline-flex"
                disabled={submitting || zoneBlocked}
              >
                {submitting
                  ? "Илгээж байна…"
                  : zoneBlocked
                    ? "Энэ хаяг руу хүргэлт хийхгүй"
                    : "Төлбөр төлөх"}
              </Button>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
                <ShieldCheck className="size-3.5" />
                Аюулгүй төлбөр · QPay
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Утасны наалдсан төлбөрийн зурвас.
            Тойм нь `lg:sticky` — десктоп дээр л. Утсан дээр дүн ба цорын ганц
            товч нь ~1900px хуудасны ёроолд байсан тул хэрэглэгч шийдэж буй
            тоогоо форм бөглөх бүх хугацаанд харахгүй байв. Доод цэсний ДЭЭР
            давхарлахгүй, түүний оронд суух тул (`useClaimBottomBar`) хэлбэрээ ч
            түүнээс авна: хөвөгч капсул + Glass Trio. */}
        {showPayBar && (
          <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 lg:hidden">
            <div className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex w-full items-center gap-3 rounded-full py-2 pr-2 pl-4 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground truncate text-[11px]">
                  {hasAddress ? "Нийт төлөх" : "Хүргэлтгүй дүн"}
                </p>
                <p className="text-base/tight font-semibold tabular-nums">
                  {formatPrice(total)}
                </p>
              </div>
              <Button
                type="submit"
                disabled={submitting || zoneBlocked}
                className="shrink-0 rounded-full"
              >
                {submitting
                  ? "Илгээж байна…"
                  : zoneBlocked
                    ? "Хүргэлтгүй"
                    : "Төлбөр төлөх"}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Шинэ хаяг — popup. Хуудсан дээр форм нээхээ больсон. */}
      <AddressDialog
        open={addressOpen}
        onOpenChange={setAddressOpen}
        initial={draft ?? undefined}
        submitLabel="Хаяг хэрэглэх"
        onSave={applyDraft}
      />

      {/* Зочны санамж: бүртгэлгүй бол V point хуримтлагдахгүй.
          Гол товч нь ЗАХИАЛГАА ҮРГЭЛЖЛҮҮЛЭХ — хэрэглэгч энэ мөчид худалдан
          авах гэж байгаа болохоос бүртгүүлэх гэж байгаа биш. Бүртгэл нь
          ноорогоо хадгалаад `?next=/checkout`-оор буцаж ирдэг тул хоёр зам
          хоёулаа аюулгүй боллоо. */}
      <ResponsiveDialog
        open={showGuestWarning}
        onOpenChange={setShowGuestWarning}
        title="Зочноор захиалахад V point хуримтлагдахгүй"
        description="Бүртгүүлбэл захиалгын дүнгийн 1% нь V point болж буцаж, дараагийн захиалгадаа зарцуулагдана. Бүртгүүлэхээр очвол бөглөсөн зүйл чинь хадгалагдаж, буцаж ирэхэд байрандаа байна."
      >
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={() => {
              guestWarned.current = true;
              setShowGuestWarning(false);
              handleSubmit(onSubmit, onInvalid)();
            }}
          >
            Зочноор үргэлжлүүлэх
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={REGISTER_HREF} onClick={keepDraft}>
              Эхлээд бүртгүүлэх
            </Link>
          </Button>
        </div>
      </ResponsiveDialog>

      {/* Бэлгээ сонгоогүй — хаалт биш сануулга. Гол товч нь буцаж очиж
          сонгох; үргэлжлүүлэх нь хоёрдогч боловч ил байна, учир нь үнэгүй
          дээжийн төлөө хэн нэгний худалдан авалтыг барих ёсгүй. */}
      <ResponsiveDialog
        open={showGiftWarning}
        onOpenChange={setShowGiftWarning}
        title={`Танд ${giftAllowance} бэлгийн дээж сонгох эрх байна`}
        description="Энэ захиалгад үнэгүй 1мл дээж дагалдана. Одоо сонгоогүй бол энэ захиалгад дээж орохгүй."
      >
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={() => {
              setShowGiftWarning(false);
              document
                .getElementById("checkout-gift")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Дээжээ сонгох
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              giftWarned.current = true;
              setShowGiftWarning(false);
              handleSubmit(onSubmit, onInvalid)();
            }}
          >
            Дээжгүй үргэлжлүүлэх
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

/**
 * Дугаарласан алхам. `id` нь заавал: форм буруу үед `onInvalid` яг энэ хэсэг
 * рүү гүйлгэдэг (`scroll-mt-24` нь толгойн доор нуугдахаас хамгаална).
 *
 * `icon` prop байсан ч `step > 0` үед хэзээ ч хүрдэггүй байсан тул хассан —
 * хоёулаа дугаартай дуудагддаг байв.
 */
function Section({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-card scroll-mt-24 rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
          <span className="text-sm font-semibold">{step}</span>
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Захиалгын тоймын нэг мөр. Мөнгөн баганыг `tabular-nums`-аар түгжсэн нь
 * дараалсан дүнгүүдийн орон нь босоогоор эгнэх цорын ганц арга.
 */
function SummaryRow({
  label,
  value,
  credit,
}: {
  label: string;
  value: string;
  /** Хасагдаж буй мөр (купон, оноо) — өнгөөр нь ялгана. */
  credit?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span className={`shrink-0 tabular-nums ${credit ? "text-success" : ""}`}>
        {value}
      </span>
    </div>
  );
}
