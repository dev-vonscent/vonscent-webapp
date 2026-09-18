import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleQpayCallback } from "../handler";
import { env } from "@/lib/env";

/**
 * QPay callback — нууц сегменттэй зам.
 *
 * QPay гарын үсэг өгдөггүй тул дуудагчийг таних цорын ганц арга нь хуваалцсан
 * нууц. Нууц нь зөвхөн QPay-д үүсгэсэн invoice-ийн `callback_url` дотор
 * явдаг (`callbackUrlFor`, invoice.ts) — хэрэглэгчийн browser-т хэзээ ч
 * харагдахгүй.
 *
 * Буруу нууц нь 404 буцаана — 401/403 нь «энд зөв зам байгаа» гэдгийг
 * баталчихдаг.
 */
export const dynamic = "force-dynamic";

function ok(secret: string): boolean {
  const expected = env.qpayCallbackSecret;
  if (!expected) return false;
  // Урт зөрөх үед `timingSafeEqual` шидэлт хийдэг тул эхлээд шалгана.
  if (secret.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
}

const NOT_FOUND = NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (!ok(secret)) return NOT_FOUND;
  return handleQpayCallback(req);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (!ok(secret)) return NOT_FOUND;
  const bodyOrderNo = await req
    .json()
    .then((b: { order_no?: string }) => b?.order_no)
    .catch(() => undefined);
  return handleQpayCallback(req, bodyOrderNo);
}
