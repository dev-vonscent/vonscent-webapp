import "server-only";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phone + passcode auth built on Supabase Auth (development.md §9.1).
 *
 * Supabase has no Mongolian SMS gateway, so each phone account is a normal
 * Supabase user under a synthetic email, and the 4-digit passcode is never
 * used as the password directly — the real password is an HMAC of the
 * passcode with a server-side pepper. Sign-in therefore only works through
 * our routes (which rate-limit), never against the Supabase API directly.
 */

const PHONE_EMAIL_DOMAIN = "phone.vonscent.mn";

export const PASSCODE_RE = /^\d{4}$/u;

/** Synthetic Supabase email for a phone account. */
export function phoneEmail(phone: string): string {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPhoneEmail(email: string | undefined | null): boolean {
  return Boolean(email?.endsWith(`@${PHONE_EMAIL_DOMAIN}`));
}

function pepper(): string {
  const value = process.env.AUTH_PASSCODE_PEPPER ?? "";
  if (!value) {
    throw new Error(
      "AUTH_PASSCODE_PEPPER is not set — phone passcode auth is unavailable",
    );
  }
  return value;
}

/** Supabase password derived from the 4-digit passcode. */
export function derivePassword(passcode: string): string {
  return createHmac("sha256", pepper()).update(passcode).digest("hex");
}

export type ConsumeResult =
  | { ok: true; phone: string; userId: string | null }
  | { ok: false; error: "NO_DB" | "NOT_VERIFIED" };

/**
 * Claim a VERIFIED verify.mn session for register / passcode reset. Each
 * session can be consumed exactly once, and only while reasonably fresh.
 */
export async function consumeVerifiedSession(
  sessionId: string,
): Promise<ConsumeResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "NO_DB" };

  // The update doubles as an atomic claim — a second call matches no row.
  // Freshness rides on expires_at (always set at creation; sessions live
  // ~5min) with a 10min grace, since verified_at isn't reliably reported.
  const { data } = await admin
    .from("verify_mn_sessions")
    .update({ consumed: true })
    .eq("session_id", sessionId)
    .eq("status", "VERIFIED")
    .eq("consumed", false)
    .gte("expires_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select("phone, user_id")
    .maybeSingle();

  const row = data as { phone: string; user_id: string | null } | null;
  if (!row) return { ok: false, error: "NOT_VERIFIED" };
  return { ok: true, phone: row.phone, userId: row.user_id };
}

/** Find the auth user id for a verified phone number. */
export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .eq("phone_verified", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AttemptGate =
  | { ok: true }
  | { ok: false; lockedForMinutes: number };

/** Check the lockout state before trying a passcode. */
export async function checkLoginAttempts(phone: string): Promise<AttemptGate> {
  const admin = createAdminClient();
  if (!admin) return { ok: true };
  const { data } = await admin
    .from("phone_login_attempts")
    .select("locked_until")
    .eq("phone", phone)
    .maybeSingle();
  const lockedUntil = (data as { locked_until: string | null } | null)
    ?.locked_until;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    return {
      ok: false,
      lockedForMinutes: Math.ceil(
        (new Date(lockedUntil).getTime() - Date.now()) / 60_000,
      ),
    };
  }
  return { ok: true };
}

/** Record a wrong passcode; lock the phone after MAX_ATTEMPTS in a row. */
export async function recordFailedLogin(phone: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("phone_login_attempts")
    .select("attempts")
    .eq("phone", phone)
    .maybeSingle();
  const attempts = ((data as { attempts: number } | null)?.attempts ?? 0) + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  await admin.from("phone_login_attempts").upsert({
    phone,
    attempts: locked ? 0 : attempts,
    locked_until: locked
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
}

export async function clearLoginAttempts(phone: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("phone_login_attempts").delete().eq("phone", phone);
}
