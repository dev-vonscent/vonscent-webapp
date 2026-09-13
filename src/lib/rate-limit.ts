import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { RATE_LIMITS, type RateLimitName } from "@/lib/constants";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";

/**
 * API-д хүсэлтийн хязгаар (backlog §2.1).
 *
 * Тоолуур нь Postgres дотор, GCRA аргаар (0076_rate_limits.sql) — санах ойд
 * тоолох нь serverless дээр утгагүй: Vercel хэдэн ч instance дулаацуулж
 * болох тул «минутад 10» гэдэг чинь instance тутамд 10 болно.
 *
 * Route handler дотор Zod шалгалтын дараа нэг мөрөөр дуудна:
 *
 *   const limited = await enforceRateLimit("contact", req);
 *   if (limited) return limited;
 */

export interface RateLimitVerdict {
  ok: boolean;
  /** Дахин оролдох хүртэлх секунд (зөвшөөрөгдсөн үед 0). */
  retryAfter: number;
  remaining: number;
  limit: number;
  /** Хувин бүрэн суларах хүртэлх секунд. */
  reset: number;
}

interface RpcVerdict {
  allowed: boolean;
  retry_after: number;
  remaining: number;
  limit: number;
  reset: number;
}

/** Субьект юу вэ — hash-ийн угтвар болж, лог уншихад тусална. */
export type SubjectKind = "user" | "phone";

export interface RateLimitOptions {
  /**
   * Хэнийг хэмжих вэ — ихэвчлэн нэвтэрсэн хэрэглэгчийн id. Handler аль хэдийн
   * `auth.getUser()` дуудсан бол түүнийгээ дамжуул: IP нь операторын NAT ард
   * олон хүнийг нэг болгож хардаг тул хэрэглэгчийн id үргэлж шударга.
   */
  subject?: string | null;
  /** `subject` нь хэрэглэгчийн id биш бол (жишээ нь утасны дугаар). */
  subjectKind?: SubjectKind;
  /** Нэг хүсэлтийн өртөг (олон зүйл зэрэг хийж буй цэгт > 1). */
  cost?: number;
}

/**
 * Клиентийн IP. Vercel дээр `x-forwarded-for`-ыг платформ өөрөө бичдэг тул
 * эхний утга нь бодит клиент (өөрөө нэмсэн утгыг нь дардаг). Локал dev болон
 * тест дээр header байхгүй — тэр үед бүгд нэг «local» субьект болно.
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Субьектийн түлхүүр. Түүхий IP нь хувийн мэдээлэл тул DB-д хэзээ ч ордоггүй
 * — зөвхөн давсалсан sha256 л үлдэнэ (тоолуурт ижил байх нь хангалттай).
 */
export function subjectKey(
  kind: SubjectKind | "ip" | "anon",
  value: string,
): string {
  const hash = createHash("sha256")
    .update(`${env.rateLimitSalt}:${kind}:${value}`)
    .digest("base64url");
  return `${kind}:${hash.slice(0, 32)}`;
}

/** Хэдэн секундын дараа гэдгийг хүнлэг монголоор. */
export function retryMessage(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe >= 60) {
    return `Хэт олон хүсэлт илгээлээ. ${Math.ceil(safe / 60)} минутын дараа дахин оролдоно уу.`;
  }
  return `Хэт олон хүсэлт илгээлээ. ${safe} секундын дараа дахин оролдоно уу.`;
}

/** Хязгаар хэтэрсний хариу — 429 + Retry-After. */
export function tooManyRequests(
  name: RateLimitName,
  verdict: RateLimitVerdict,
): NextResponse {
  const policy = RATE_LIMITS[name];
  const res = NextResponse.json(
    { error: "RATE_LIMITED", message: retryMessage(verdict.retryAfter) },
    { status: 429 },
  );
  // Retry-After нь бүх клиент, прокси ойлгодог цорын ганц стандарт (RFC 9110).
  res.headers.set("Retry-After", String(Math.max(1, verdict.retryAfter)));
  // RateLimit / RateLimit-Policy нь IETF-ийн ноорог (draft-ietf-httpapi-
  // ratelimit-headers) — нэмэлт мэдээлэл, хэн ч заавал уншихгүй.
  res.headers.set(
    "RateLimit",
    `"${name}";r=${verdict.remaining};t=${Math.max(1, verdict.retryAfter)}`,
  );
  res.headers.set(
    "RateLimit-Policy",
    `"${name}";q=${policy.limit};w=${policy.windowSec}`,
  );
  return res;
}

/**
 * Нэг хүсэлт зарцуулна.
 *
 * DB байхгүй (demo) эсвэл RPC унасан үед **нэвтрүүлнэ** (fail-open): тоолуурын
 * доголдол нь бодит захиалгыг зогсоох шалтгаан биш. Гэхдээ чимээгүй өнгөрөхгүй
 * — Sentry рүү мэдэгдэнэ.
 */
export async function checkRateLimit(
  name: RateLimitName,
  req: Request,
  options: RateLimitOptions = {},
): Promise<RateLimitVerdict> {
  const policy = RATE_LIMITS[name];
  const pass: RateLimitVerdict = {
    ok: true,
    retryAfter: 0,
    remaining: policy.limit,
    limit: policy.limit,
    reset: 0,
  };

  const supabase = createAdminClient();
  if (!supabase) return pass;

  const subject = options.subject
    ? subjectKey(options.subjectKind ?? "user", options.subject)
    : (() => {
        const ip = clientIp(req);
        return ip ? subjectKey("ip", ip) : subjectKey("anon", "local");
      })();

  const { data, error } = await callRpc<RpcVerdict>(
    supabase,
    "consume_rate_limit",
    {
      p_bucket: name,
      p_subject: subject,
      p_limit: policy.limit,
      p_period_seconds: policy.windowSec,
      p_cost: options.cost ?? 1,
    },
  );

  if (error || !data) {
    Sentry.captureException(
      new Error(`consume_rate_limit failed (${name}): ${error?.message}`),
    );
    return pass;
  }

  return {
    ok: data.allowed,
    retryAfter: data.retry_after,
    remaining: data.remaining,
    limit: data.limit,
    reset: data.reset,
  };
}

/**
 * `checkRateLimit` + бэлэн 429. Зөвшөөрөгдсөн бол `null` — handler үргэлжилнэ.
 */
export async function enforceRateLimit(
  name: RateLimitName,
  req: Request,
  options: RateLimitOptions = {},
): Promise<NextResponse | null> {
  const verdict = await checkRateLimit(name, req, options);
  return verdict.ok ? null : tooManyRequests(name, verdict);
}
