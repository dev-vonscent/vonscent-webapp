import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** `Authorization: Bearer $CRON_SECRET` — Vercel cron үүнийг өөрөө илгээдэг. */
export function isCronAuthorised(req: Request): boolean {
  if (!env.cronSecret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  // Урт нь зөрөх үед `timingSafeEqual` шидэлт хийдэг тул эхлээд шалгана.
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Cron route-ийн хаалга: зөвшөөрөгдөөгүй бол буцаах хариу, зөвшөөрөгдсөн бол
 * `null`. Нууц тавигдаагүй бол route ажиллахгүй (503) — мартсан env нь
 * чимээгүйхэн нээлттэй endpoint болох ёсгүй.
 */
export function cronGuard(req: Request): NextResponse | null {
  if (!env.cronSecret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ error: "UNAUTHORISED" }, { status: 401 });
  }
  return null;
}
