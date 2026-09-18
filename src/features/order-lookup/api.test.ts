import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Зочны захиалга хайх — аюулгүй байдлын гол зан төлөв.
 *
 * `order_no` нь `VS-1000`, `VS-1001` … гэсэн дараалсан sequence (0006). Энэ
 * функц нь утсыг ЗААВАЛ тааруулах ёстой, эс тэгвээс хэн ч дугаараа нэмэгдүүлэн
 * бусдын захиалгын токеныг татаж авах боломжтой болно.
 */

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

const { findOrderByNoAndPhone } = await import("./api");

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  from.mockClear();
});

describe("findOrderByNoAndPhone", () => {
  it("returns the token when the number and phone both match", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: "99112233", pay_token: "tok" },
    });
    expect(await findOrderByNoAndPhone("VS-1042", "99112233")).toBe("tok");
  });

  it("refuses a correct order number with the wrong phone", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: "99112233", pay_token: "tok" },
    });
    expect(await findOrderByNoAndPhone("VS-1042", "88112233")).toBeNull();
  });

  it("returns null for an order that does not exist", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(await findOrderByNoAndPhone("VS-9999", "99112233")).toBeNull();
  });

  it("ignores formatting in the phone the customer types", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: "99112233", pay_token: "tok" },
    });
    expect(await findOrderByNoAndPhone("VS-1042", "9911-2233")).toBe("tok");
    expect(await findOrderByNoAndPhone("VS-1042", " 9911 2233 ")).toBe("tok");
  });

  it("uppercases and trims the order number, so 'vs-1042 ' still resolves", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: "99112233", pay_token: "tok" },
    });
    await findOrderByNoAndPhone(" vs-1042 ", "99112233");
    expect(eq).toHaveBeenCalledWith("order_no", "VS-1042");
  });

  it("returns null when the order has no pay token — nothing to hand out", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: "99112233", pay_token: null },
    });
    expect(await findOrderByNoAndPhone("VS-1042", "99112233")).toBeNull();
  });

  it("returns null when the order has no phone on file, rather than matching an empty string", async () => {
    maybeSingle.mockResolvedValue({
      data: { contact_phone: null, pay_token: "tok" },
    });
    expect(await findOrderByNoAndPhone("VS-1042", "")).toBeNull();
  });
});
