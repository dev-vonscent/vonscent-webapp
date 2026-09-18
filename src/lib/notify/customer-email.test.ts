import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Захиалгын имэйлийн ХҮЛЭЭН АВАГЧ.
 *
 * Энэ нь урсгалын хамгийн эмзэг зангилааны нэг: өмнө нь имэйл ЗӨВХӨН
 * `newsletter_subscribers.email` рүү явдаг байсан тул зочин хэрэглэгч
 * захиалгын дугаараа хэзээ ч аваагүй — `/pay/<token>`-оос гарчихвал буцах зам
 * байхгүй болдог байв. Одоо checkout дээр бичсэн хаяг тэргүүн ээлжинд.
 *
 * Регрессийн эрсдэл: бүртгэлтэй хэрэглэгчийн хуучин зан төлөв (unsubscribe
 * линктэй, жагсаалтаас гарсан бол илгээхгүй) хэвээр байх ёстой.
 */

type SentMail = {
  to: string;
  subject: string;
  headers?: Record<string, string>;
};
const sendEmail = vi.fn(async (params: SentMail) => Boolean(params));
const tables: Record<string, unknown> = {};

function makeClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: tables[table] ?? null }),
        }),
      }),
    }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeClient(),
}));
vi.mock("@/lib/email", () => ({
  sendEmail,
  STORE_INBOX: "store@vonscent.mn",
  renderEmail: () => ({ html: "<p/>", text: "t" }),
}));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://vonscent.mn" } }));

const { sendOrderCustomerEmail } = await import("./customer-email");

const ORDER = {
  order_no: "VS-1042",
  subtotal: 50_000,
  shipping_fee: 5_000,
  discount: 0,
  loyalty_used: 0,
  total: 55_000,
  user_id: null as string | null,
  payment_status: "unpaid",
  created_at: "2026-09-16T00:00:00Z",
  deliver_on: "2026-09-17",
  contact_email: null as string | null,
  pay_token: "tok123",
  status: "pending",
};

beforeEach(() => {
  sendEmail.mockClear();
  for (const k of Object.keys(tables)) delete tables[k];
});

describe("sendOrderCustomerEmail — recipient", () => {
  it("sends a guest's order to the address they typed at checkout", async () => {
    tables.orders = { ...ORDER, contact_email: "guest@example.mn" };
    await sendOrderCustomerEmail("id", "placed");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]![0]).toMatchObject({
      to: "guest@example.mn",
    });
  });

  it("omits List-Unsubscribe on a guest's transactional mail — they joined no list", async () => {
    tables.orders = { ...ORDER, contact_email: "guest@example.mn" };
    await sendOrderCustomerEmail("id", "placed");
    expect(sendEmail.mock.calls[0]![0].headers).toBeUndefined();
  });

  it("prefers the typed address over the account's subscription address", async () => {
    tables.orders = {
      ...ORDER,
      user_id: "u1",
      contact_email: "typed@example.mn",
    };
    tables.newsletter_subscribers = {
      email: "account@example.mn",
      token: "t",
      is_active: true,
    };
    await sendOrderCustomerEmail("id", "placed");
    expect(sendEmail.mock.calls[0]![0].to).toBe("typed@example.mn");
  });

  it("falls back to the subscription address, with its unsubscribe header", async () => {
    tables.orders = { ...ORDER, user_id: "u1" };
    tables.newsletter_subscribers = {
      email: "account@example.mn",
      token: "tok",
      is_active: true,
    };
    await sendOrderCustomerEmail("id", "paid");
    const call = sendEmail.mock.calls[0]![0];
    expect(call.to).toBe("account@example.mn");
    expect(call.headers?.["List-Unsubscribe"]).toContain("token=tok");
  });

  it("stays silent for a guest who gave no address — nowhere agreed to send", async () => {
    tables.orders = { ...ORDER };
    await sendOrderCustomerEmail("id", "placed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("respects an unsubscribed account", async () => {
    tables.orders = { ...ORDER, user_id: "u1" };
    tables.newsletter_subscribers = {
      email: "account@example.mn",
      token: "t",
      is_active: false,
    };
    await sendOrderCustomerEmail("id", "paid");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("labels the three kinds distinctly so a customer can tell them apart", async () => {
    tables.orders = { ...ORDER, contact_email: "g@example.mn" };
    await sendOrderCustomerEmail("id", "placed");
    await sendOrderCustomerEmail("id", "paid");
    await sendOrderCustomerEmail("id", "cancelled");
    const subjects = sendEmail.mock.calls.map((c) => c[0]!.subject);
    expect(new Set(subjects).size).toBe(3);
    expect(subjects[0]).toContain("хүлээн авлаа");
    expect(subjects[1]).toContain("баталгаажлаа");
    expect(subjects[2]).toContain("цуцлагдлаа");
  });
});
