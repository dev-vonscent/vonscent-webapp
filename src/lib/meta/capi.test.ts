import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Meta CAPI Purchase. Гол баталгаа:
 *   - туг хаалттай / token-гүй / mock төлбөр үед Meta руу юу ч явахгүй
 *   - утас, имэйл зөвхөн hash-лагдаж явна, хоосон талбар огт явахгүй
 *   - алдаа гарсан ч throw хийхгүй (төлбөрийн commit эвдэхгүй)
 */

const envMock = {
  siteUrl: "https://vonscent.mn",
  metaPixelId: "1670068291268354",
  metaCapiToken: "tok",
  metaCapiTestEventCode: "",
};
vi.mock("@/lib/env", () => ({ env: envMock }));

let flagOn = true;
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(async () => flagOn),
}));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...a),
  captureMessage: vi.fn(),
}));

const {
  buildPurchaseEvent,
  captureOrderContext,
  metaCookies,
  normalizeEmail,
  normalizePhone,
  reportPurchase,
  sha256,
} = await import("./capi");

const ORDER = {
  order_no: "VS-1042",
  total: 145000,
  contact_phone: "9912 3456",
  contact_email: " Bat@Example.MN ",
  user_id: "u-1",
  meta_fbp: "fb.1.1700000000000.123",
  meta_fbc: null,
  client_ip: "203.0.113.7",
  client_user_agent: "Mozilla/5.0",
};
const ITEMS = [
  { product_id: "p-1", qty: 2, is_sample: false, is_gift: false },
  { product_id: "p-1", qty: 1, is_sample: false, is_gift: false },
  { product_id: "p-2", qty: 1, is_sample: true, is_gift: false },
  { product_id: "p-3", qty: 1, is_sample: false, is_gift: true },
];

/** `from(table).select().eq().maybeSingle()` болон `.update().eq()` дуураймал. */
function makeSupabase() {
  const updates: unknown[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => {
          const q = {
            eq: () => q,
            maybeSingle: async () => ({ data: ORDER, error: null }),
            then: (r: (v: unknown) => unknown) =>
              r({ data: table === "order_items" ? ITEMS : [], error: null }),
          };
          return q;
        },
        update: (v: unknown) => {
          updates.push(v);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  return { client: client as never, updates };
}

const fetchMock = vi.fn();

beforeEach(() => {
  flagOn = true;
  envMock.metaCapiToken = "tok";
  envMock.metaCapiTestEventCode = "";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  captureException.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("normalize", () => {
  it("adds 976 to an 8-digit number and strips formatting", () => {
    expect(normalizePhone("9912 3456")).toBe("97699123456");
    expect(normalizePhone("+976-9912-3456")).toBe("97699123456");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("lowercases and trims email, rejects non-emails", () => {
    expect(normalizeEmail(" Bat@Example.MN ")).toBe("bat@example.mn");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("nope")).toBeNull();
  });

  it("reads _fbp/_fbc from the cookie header", () => {
    expect(metaCookies("a=1; _fbp=fb.1.2.3; _fbc=fb.1.2.abc")).toEqual({
      fbp: "fb.1.2.3",
      fbc: "fb.1.2.abc",
    });
    expect(metaCookies(null)).toEqual({ fbp: null, fbc: null });
  });
});

describe("buildPurchaseEvent", () => {
  const base = {
    orderNo: "VS-1",
    value: 1000,
    contentIds: ["p-1"],
    numItems: 1,
    eventTime: 1700000000,
    eventSourceUrl: "https://vonscent.mn/checkout",
    phone: "99123456",
    email: "a@b.mn",
    userId: "u-1",
    fbp: "fb.1.1.1",
    fbc: null,
    ip: null,
    userAgent: "UA",
  };

  it("hashes ph/em/external_id and keeps fbp/UA raw", () => {
    const e = buildPurchaseEvent(base);
    expect(e.event_id).toBe("VS-1");
    expect(e.action_source).toBe("website");
    expect(e.user_data.ph).toEqual([sha256("97699123456")]);
    expect(e.user_data.em).toEqual([sha256("a@b.mn")]);
    expect(e.user_data.external_id).toEqual([sha256("u-1")]);
    expect(e.user_data.fbp).toBe("fb.1.1.1");
    expect(e.user_data.client_user_agent).toBe("UA");
    expect(JSON.stringify(e)).not.toContain("99123456\"");
  });

  it("omits empty fields instead of sending hashes of nothing", () => {
    const e = buildPurchaseEvent({ ...base, email: null, fbc: null, ip: null });
    expect(e.user_data).not.toHaveProperty("em");
    expect(e.user_data).not.toHaveProperty("fbc");
    expect(e.user_data).not.toHaveProperty("client_ip_address");
  });
});

describe("reportPurchase", () => {
  it("posts one deduplicable Purchase with real items only", async () => {
    const { client } = makeSupabase();
    await reportPurchase(client, "o-1", "qpay");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://graph.facebook.com/v26.0/1670068291268354/events",
    );
    const body = JSON.parse(init.body);
    expect(body.access_token).toBe("tok");
    expect(body).not.toHaveProperty("test_event_code");
    const [event] = body.data;
    expect(event.event_id).toBe("VS-1042");
    expect(event.custom_data).toMatchObject({
      value: 145000,
      currency: "MNT",
      content_ids: ["p-1"],
      num_items: 3,
    });
    expect(event.event_source_url).toBe("https://vonscent.mn/checkout");
  });

  it("sends nothing while the flag is off", async () => {
    flagOn = false;
    await reportPurchase(makeSupabase().client, "o-1", "qpay");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing without a token", async () => {
    envMock.metaCapiToken = "";
    await reportPurchase(makeSupabase().client, "o-1", "manual");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips mock payments unless a test event code routes them to Test events", async () => {
    await reportPurchase(makeSupabase().client, "o-1", "mock");
    expect(fetchMock).not.toHaveBeenCalled();

    envMock.metaCapiTestEventCode = "TEST16232";
    await reportPurchase(makeSupabase().client, "o-1", "mock");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).test_event_code).toBe(
      "TEST16232",
    );
  });

  it("never throws when Meta is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(
      reportPurchase(makeSupabase().client, "o-1", "qpay"),
    ).resolves.toBeUndefined();
    expect(captureException).toHaveBeenCalled();
  });
});

describe("captureOrderContext", () => {
  const req = new Request("https://vonscent.mn/api/orders", {
    method: "POST",
    headers: {
      cookie: "_fbp=fb.1.2.3",
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      "user-agent": "UA",
    },
  });

  it("stores cookies, IP and UA when the flag is on", async () => {
    const { client, updates } = makeSupabase();
    await captureOrderContext(client, "o-1", req);
    expect(updates).toEqual([
      {
        meta_fbp: "fb.1.2.3",
        meta_fbc: null,
        client_ip: "203.0.113.7",
        client_user_agent: "UA",
      },
    ]);
  });

  it("stores nothing while the flag is off", async () => {
    flagOn = false;
    const { client, updates } = makeSupabase();
    await captureOrderContext(client, "o-1", req);
    expect(updates).toEqual([]);
  });
});
