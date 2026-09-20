import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `ensureInvoice` — идемпотентын хил.
 *
 * QPay нь `sender_invoice_no` давхардлыг хориглодоггүй (qpay/FINDINGS §2), тул
 * нэг захиалгад хоёр бодит invoice үүсч болно. Тэр тохиолдолд хэрэглэгч нэгийг
 * нь төлөхөд `orders.qpay_invoice_id` нөгөөг нь заасаар байх тул төлбөр
 * МӨНХӨД «төлөгдөөгүй» үлдэнэ. Эдгээр тест яг түүнээс хамгаална.
 */

const createInvoice = vi.fn();
let mockMode = false;

vi.mock("./qpay", () => ({
  createInvoice: (...a: unknown[]) => createInvoice(...a),
  isQpayMockMode: () => mockMode,
  toDataUrl: (v: string | null) => (v ? `data:image/png;base64,${v}` : null),
}));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://vonscent.mn" } }));

const { ensureInvoice } = await import("./invoice");

/**
 * Хамгийн бага Supabase дуураймал: `qpay_invoices`-ыг нэг мөрт хүснэгт гэж
 * үзнэ. `upsert(..., ignoreDuplicates)` нь мөр байхгүй үед л мөр буцаана —
 * Postgres-ийн `on conflict do nothing` -тэй ижил.
 */
function makeSupabase() {
  let row: Record<string, unknown> | null = null;
  const client = {
    /** Тест дотроос мөрийг харах. */
    peek: () => row,
    from(table: string) {
      if (
        table !== "qpay_invoices" &&
        table !== "orders" &&
        table !== "settings"
      )
        throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === "qpay_invoices" ? row : null,
            }),
          }),
        }),
        upsert: (values: Record<string, unknown>) => ({
          select: async () => {
            if (row) return { data: [] }; // conflict → do nothing
            row = { ...values, invoice_id: null, qr_text: null };
            return { data: [{ order_id: values.order_id }] };
          },
        }),
        /**
         * `update` нь шүүлтээ хуримтлуулна. `claim`-ийн эзэмшил булаах салаа
         * нь `.is("invoice_id", null).lt("claimed_at", cutoff)` -ээр
         * хамгаалагддаг тул дуураймал эдгээрийг ҮЛ ТООМСОРЛОВОЛ хожигдсон тал
         * эзэмшлийг булаачихаад QPay руу давхар залгана — өөрөөр хэлбэл
         * дуураймал нь өөрөө яг тэр алдааг нуух болно.
         */
        update: (values: Record<string, unknown>) => {
          const filters: {
            isNull?: string;
            ltField?: string;
            ltValue?: string;
          } = {};
          const matches = () => {
            if (!row) return false;
            if (filters.isNull && row[filters.isNull] != null) return false;
            if (
              filters.ltField &&
              !(String(row[filters.ltField]) < String(filters.ltValue))
            )
              return false;
            return true;
          };
          const apply = () => {
            if (matches()) {
              row = { ...row, ...values };
              return [row];
            }
            return [];
          };
          const chain = {
            eq: () => chain,
            is: (field: string) => {
              filters.isNull = field;
              return chain;
            },
            lt: (field: string, value: string) => {
              filters.ltField = field;
              filters.ltValue = value;
              return chain;
            },
            select: async () => ({ data: apply() }),
          };
          // `update().eq()` -ийг шууд await хийдэг дуудлагуудад зориулж
          // thenable болгоно.
          return Object.assign(
            Promise.resolve().then(() => {
              apply();
              return { data: null };
            }),
            chain,
          );
        },
        delete: () => ({
          eq: async () => {
            row = null;
            return { data: null };
          },
        }),
      };
    },
  };
  return client;
}

const ORDER = { id: "o1", order_no: "VS-1042", total: 55_000, user_id: null };

const QPAY_OK = {
  invoiceId: "inv-A",
  qrText: "qr",
  qrImage: "base64",
  shortUrl: "https://s.qpay.mn/a",
  deeplinks: [],
  mock: false,
};

beforeEach(() => {
  createInvoice.mockReset();
  mockMode = false;
});

describe("ensureInvoice", () => {
  it("creates one invoice and returns it", async () => {
    createInvoice.mockResolvedValue(QPAY_OK);
    const sb = makeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const got = await ensureInvoice(sb as any, ORDER);
    expect(got?.invoiceId).toBe("inv-A");
    expect(createInvoice).toHaveBeenCalledTimes(1);
  });

  it("calls QPay exactly once for two concurrent callers", async () => {
    // Хоёр дахь дуудагч эзэмшлийг алдаж, QPay руу ОГТ залгах ёсгүй.
    createInvoice.mockImplementation(
      async () => new Promise((r) => setTimeout(() => r({ ...QPAY_OK }), 50)),
    );
    const sb = makeSupabase();
    const [a, b] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensureInvoice(sb as any, ORDER),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensureInvoice(sb as any, ORDER),
    ]);
    expect(createInvoice).toHaveBeenCalledTimes(1);
    // Хоёулаа ИЖИЛ invoice харна — өмнө нь тус тусынхаа invoice-ыг буцаадаг
    // байсан тул нэг таб DB-д байхгүй QR зурдаг байв.
    expect(a?.invoiceId).toBe("inv-A");
    expect(b?.invoiceId).toBe("inv-A");
  });

  it("reuses the stored invoice instead of creating a second one", async () => {
    createInvoice.mockResolvedValue(QPAY_OK);
    const sb = makeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ensureInvoice(sb as any, ORDER);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const again = await ensureInvoice(sb as any, ORDER);
    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(again?.invoiceId).toBe("inv-A");
  });

  it("releases the claim when QPay fails, so the next open can retry", async () => {
    createInvoice.mockResolvedValueOnce(null);
    const sb = makeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await ensureInvoice(sb as any, ORDER)).toBeNull();
    expect(sb.peek()).toBeNull();

    createInvoice.mockResolvedValueOnce(QPAY_OK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await ensureInvoice(sb as any, ORDER))?.invoiceId).toBe("inv-A");
  });

  it("never persists a mock invoice — a dev artefact must not pin itself to a real order", async () => {
    mockMode = true;
    createInvoice.mockResolvedValue({ ...QPAY_OK, mock: true });
    const sb = makeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const got = await ensureInvoice(sb as any, ORDER);
    expect(got?.invoiceId).toBe("inv-A");
    expect(sb.peek()).toBeNull();
  });
});
