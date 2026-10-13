/**
 * Админы «Урамшуулал» хуудасны табууд — купоныг ҮҮССЭН ЭХ СУРВАЛЖААР нь
 * ангилна. Бүх купон нэг хүснэгтэд холилдохоор «энэ хаанаас гарсан бэ» гэдэг
 * нь ойлгомжгүй байсан (клиентийн хүсэлт).
 *
 * Ангилал нь санд байгаа баганаас шууд гарна (migration шаардахгүй):
 * - code     — `user_id` хоосон: кодоо мэддэг хэн ч ашиглана
 * - personal — админ тодорхой хэрэглэгчид өгсөн
 * - auto     — төлсөн захиалгын шатлалаар олгогдсон (`source_order_id`)
 * - spin     — азын хүрднээс хожсон (`source = 'spin'`)
 */

export const COUPON_TABS = ["code", "personal", "auto", "spin"] as const;
export type CouponTab = (typeof COUPON_TABS)[number];

export const COUPON_TAB_LABEL: Record<CouponTab, string> = {
  code: "Нийтийн",
  personal: "Хувийн",
  auto: "Автомат",
  spin: "Азын хүрд",
};

export const COUPON_STATUSES = ["active", "used", "expired", "all"] as const;
export type CouponStatusFilter = (typeof COUPON_STATUSES)[number];

export const COUPON_STATUS_LABEL: Record<CouponStatusFilter, string> = {
  active: "Идэвхтэй",
  used: "Ашигласан",
  expired: "Дууссан",
  all: "Бүгд",
};

/**
 * «Хувийн» таб доторх эх сурвалж: админ гараар өгсөн, эсвэл кампанит ажлаас
 * (0135, `source = 'campaign'`) автоматаар очсон. Тусдаа таб биш — хоёулаа
 * тодорхой хэрэглэгчийн хувийн купон тул нэг жагсаалтад, шүүлтүүрээр ялгана.
 */
export const PERSONAL_ORIGINS = ["all", "manual", "campaign"] as const;
export type PersonalOrigin = (typeof PERSONAL_ORIGINS)[number];

export const PERSONAL_ORIGIN_LABEL: Record<PersonalOrigin, string> = {
  all: "Бүгд",
  manual: "Админы өгсөн",
  campaign: "Кампанит ажил",
};

export function parsePersonalOrigin(v: string | undefined): PersonalOrigin {
  return PERSONAL_ORIGINS.includes(v as PersonalOrigin)
    ? (v as PersonalOrigin)
    : "all";
}

export function parseCouponTab(v: string | undefined): CouponTab {
  return COUPON_TABS.includes(v as CouponTab) ? (v as CouponTab) : "code";
}

export function parseCouponStatus(v: string | undefined): CouponStatusFilter {
  return COUPON_STATUSES.includes(v as CouponStatusFilter)
    ? (v as CouponStatusFilter)
    : "active";
}

/** Табууд тухайн купоныг өөрсдөө үүсгэдэг эсэх — «Купон үүсгэх» товч. */
export function tabAllowsCreate(tab: CouponTab): boolean {
  return tab === "code" || tab === "personal";
}

/**
 * Supabase query builder-ийн бидэнд хэрэгтэй хэсэг. Бодит builder-ийн төрөл
 * хэт гүн generic тул (TS2589) дуудагч нэг удаа cast хийнэ; тест нь энэ
 * интерфэйсийг бичигчээр хангана.
 */
export interface CouponFilterQuery {
  is(column: string, value: null | boolean): CouponFilterQuery;
  not(column: string, op: string, value: null): CouponFilterQuery;
  eq(column: string, value: unknown): CouponFilterQuery;
  neq(column: string, value: unknown): CouponFilterQuery;
  or(filter: string): CouponFilterQuery;
}

/**
 * Табын нөхцөл (дөрвөн таб давхцахгүй, нийлбэрээрээ бүх купоныг хамарна) ба
 * төлвийн нөхцөл. Төлөв нь хэрэглэгчийн «Миний купон»-ы `couponStatus`-тай
 * ижил дүрэмтэй: ашигласан нь давамгайлна; админ унтраасан эсвэл хугацаа нь
 * өнгөрсөн бол дууссан.
 */
export function filterCoupons(
  q: CouponFilterQuery,
  tab: CouponTab,
  status: CouponStatusFilter,
  nowIso: string,
  /** Зөвхөн «Хувийн» табд; бусад табд үл тооно. */
  origin: PersonalOrigin = "all",
): CouponFilterQuery {
  switch (tab) {
    case "code":
      q = q.is("user_id", null);
      break;
    case "personal":
      q = q
        .not("user_id", "is", null)
        .is("source_order_id", null)
        .neq("source", "spin");
      if (origin === "manual") q = q.neq("source", "campaign");
      if (origin === "campaign") q = q.eq("source", "campaign");
      break;
    case "auto":
      q = q.not("source_order_id", "is", null);
      break;
    case "spin":
      q = q.is("source_order_id", null).eq("source", "spin");
      break;
  }
  switch (status) {
    case "active":
      return q
        .eq("used_up", false)
        .eq("is_active", true)
        .or(`ends_at.is.null,ends_at.gt."${nowIso}"`);
    case "used":
      return q.eq("used_up", true);
    case "expired":
      return q
        .eq("used_up", false)
        .or(`is_active.eq.false,ends_at.lte."${nowIso}"`);
    case "all":
      return q;
  }
}
