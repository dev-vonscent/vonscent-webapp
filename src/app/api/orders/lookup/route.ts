import { NextResponse } from "next/server";
import { z } from "zod";
import { findOrderByNoAndPhone } from "@/features/order-lookup/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Захиалга хайх — зочин хэрэглэгчийн сэргээх зам.
 *
 * `order_no` нь `VS-1000`, `VS-1001` … гэсэн дараалсан sequence (0006) тул
 * ГАНЦААРАА хэзээ ч хангалттай биш: захиалгад бүртгүүлсэн утасны дугаартай
 * хамт л таарна. SMS илгээхгүй — verify.mn-ийн дуудалт бүр төлбөртэй бөгөөд
 * энд шаардлагагүй: утсаа мэдэж байгаа нь захиалагч гэдгийн хангалттай
 * нотолгоо, харин таагаад олоход 10 сая хувилбар + хязгаарлалт саад болно.
 *
 * Бүх сөрөг үр дүн НЭГ ижил хариу буцаана — «захиалга байхгүй» ба «утас
 * буруу» хоёрыг ялгавал дараалсан дугаараар захиалгын оршин буйг тандах
 * оракул нээгдэнэ.
 */
const schema = z.object({
  orderNo: z.string().trim().min(3).max(32),
  phone: z.string().trim().min(6).max(20),
});

const GENERIC = {
  error: "NOT_FOUND",
  message: "Захиалга олдсонгүй. Дугаар, утсаа шалгаад дахин оролдоно уу.",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  // Хэлбэрийн алдаа ч ижил хариу авна: «дугаар нь буруу форматтай» гэдэг ч
  // мэдээлэл, бас хэрэглэгчид тус болохгүй.
  if (!parsed.success) return NextResponse.json(GENERIC, { status: 404 });

  const limited = await enforceRateLimit("orderLookup", req);
  if (limited) return limited;

  const token = await findOrderByNoAndPhone(
    parsed.data.orderNo,
    parsed.data.phone,
  );
  if (!token) return NextResponse.json(GENERIC, { status: 404 });

  return NextResponse.json({ token });
}
