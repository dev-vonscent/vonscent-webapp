/**
 * Тестийн fixture — dev сангийн VS-2247 захиалгын бүтэц (2026-11): дан 4
 * (холимог ml, Goddess нь Black Friday −20%), NIGHT OUT 2ml + 10ml (bundle
 * event), сарын 1ml бэлэг 3. Мөрүүд сангаас ирдэг шигээ физик дарааллаар.
 *
 * gross_subtotal 756 900 + Black Friday 19 100 = «Нийт үндсэн үнэ» 776 000.
 */
export const VS2247_NIGHT_OUT = "night-out";

export const VS2247_ORDER = {
  subtotal: 740500,
  gross_subtotal: 756900,
  sale_breakdown: [{ label: "Black Friday", amount: 19100 }],
  coupon_code: null,
  shipping_fee: 8000,
  discount: 0,
  loyalty_used: 0,
  total: 748500,
} as const;

/** «Нийт үндсэн үнэ» — мөрүүдийн нийлбэр үүнтэй таарах ёстой. */
export const VS2247_BASE_TOTAL = 776000;

type Row = {
  id: string;
  line_no: number;
  product_id: string;
  product_name: string;
  brand: string;
  ml: number;
  qty: number;
  unit_price: number;
  list_price: number;
  base_price: number | null;
  sale_label: string | null;
  line_total: number;
  is_gift: boolean;
  is_sample: boolean;
  spin_id: string | null;
  collection_id: string | null;
  collection_name: string | null;
  line_kind: "perfume";
  variant_label: null;
  image_url: null;
};

const row = (
  n: number,
  brand: string,
  name: string,
  ml: number,
  unit: number,
  list: number,
  over: Partial<Row> = {},
): Row => ({
  id: `vs2247-${String(n).padStart(2, "0")}`,
  line_no: n,
  product_id: `p-${name.toLowerCase().replace(/\W+/g, "-")}`,
  product_name: name,
  brand,
  ml,
  qty: 1,
  unit_price: unit,
  list_price: list,
  base_price: list,
  sale_label: null,
  line_total: unit,
  is_gift: false,
  is_sample: false,
  spin_id: null,
  collection_id: null,
  collection_name: null,
  line_kind: "perfume",
  variant_label: null,
  image_url: null,
  ...over,
});

const night = (
  n: number,
  brand: string,
  name: string,
  ml: number,
  unit: number,
  list: number,
) =>
  row(n, brand, name, ml, unit, list, {
    collection_id: VS2247_NIGHT_OUT,
    collection_name: "NIGHT OUT",
  });

const gift = (n: number, brand: string, name: string) =>
  row(n, brand, name, 1, 0, 0, {
    base_price: null,
    is_gift: true,
    is_sample: true,
  });

export const VS2247_ITEMS: Row[] = [
  night(6, "Viktor&Rolf", "Spicebomb Extreme", 2, 16200, 18000),
  night(7, "Versace", "Eros Flame", 2, 12600, 14000),
  night(8, "Dior", "Homme intense", 2, 18000, 20000),
  night(9, "Rabanne", "Invictus Victory elixir", 10, 59850, 63000),
  night(10, "Viktor&Rolf", "Spicebomb Extreme", 10, 65550, 69000),
  night(11, "Versace", "Eros Flame", 10, 47500, 50000),
  night(12, "Dior", "Homme intense", 10, 74100, 78000),
  gift(13, "Bvlgari", "Glacial Essence"),
  gift(14, "Dior", "Homme intense"),
  gift(15, "Giorgio Armani", "My Way"),
  row(1, "Tom Ford", "Oud Wood", 20, 256000, 256000),
  row(2, "Creed", "Aventus", 5, 79000, 79000),
  row(3, "Burberry", "Goddess EDP", 10, 62400, 62400, {
    base_price: 78000,
    sale_label: "Black Friday",
  }),
  row(4, "Byredo", "Blanche", 2, 34000, 34000),
  night(5, "Rabanne", "Invictus Victory elixir", 2, 15300, 17000),
];
