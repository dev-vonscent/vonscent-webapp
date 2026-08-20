import "server-only";

import { randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPhoneEmail, phoneEmail } from "@/lib/auth/phone";
import { env } from "@/lib/env";

/**
 * verify.mn — Mongolia-only Mobile-Originated SMS phone verification.
 *
 * Flow: we open a session (POST /sessions) with a one-time code; the user
 * texts that code to shortcode 144773 from their own phone; verify.mn then
 * pings our callback URL. The callback is unauthenticated (GET, no body, no
 * signature), so it is only a wake-up signal — the session status is always
 * re-fetched from GET /sessions/{id} before anything is marked verified.
 */

const VERIFY_MN_BASE = "https://api.verify.mn";

/** verify.mn rejects the same session polled faster than every 2s (429). */
const POLL_INTERVAL_MS = 3_000;

export type VerifyMnStatus = "PENDING" | "VERIFIED" | "EXPIRED";

export interface VerifyMnSession {
  sessionId: string;
  phone: string;
  shortcode: string;
  text: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export interface VerifyMnSessionStatus {
  sessionId: string;
  phone: string;
  sessionStatus: VerifyMnStatus;
  callbackStatus: "PENDING" | "SENT" | "FAILED";
  verifiedAt: string | null;
  expiresAt: string;
}

function apiKey(): string {
  const key = process.env.VERIFY_MN_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "VERIFY_MN_API_KEY is not set — phone verification via verify.mn is unavailable",
    );
  }
  return key;
}

export const isVerifyMnConfigured = () =>
  Boolean(process.env.VERIFY_MN_API_KEY);

/** One-time numeric code the user must text to the shortcode. */
function randomSmsCode(): string {
  return String(randomInt(100000, 1000000));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Open a verification session and persist it (linked to the user when given)
 * so the callback route can find it later.
 */
export async function createVerificationSession(
  phone: string,
  opts: { userId?: string } = {},
): Promise<VerifyMnSession> {
  // The callback GET carries no body, so the URL itself must identify the
  // session. The sessionId doesn't exist until after this POST, so we mint
  // our own token and store the mapping alongside the session row.
  //
  // verify.mn retries failed callbacks and explicitly forbids unreachable
  // URLs (localhost permanently FAILs delivery), so the callback is only
  // sent on a public https site — otherwise we rely on polling alone.
  const callbackToken = crypto.randomUUID();
  const callback = env.siteUrl.startsWith("https://")
    ? new URL(
        `/api/auth/verify-mn/callback?token=${callbackToken}`,
        env.siteUrl,
      ).toString()
    : undefined;
  const res = await fetch(`${VERIFY_MN_BASE}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      text: randomSmsCode(),
      callback,
      // Reply SMS shown to the user after they text in. ASCII only (<=160
      // chars) — Cyrillic is rejected by validation.
      responseSms: "vonscent: Tany dugaar amjilttai batalgaajlaa. Bayarlalaa!",
    }),
  });

  if (res.status === 401) {
    // Never echo the key itself — just say it was rejected.
    throw new Error("verify.mn rejected VERIFY_MN_API_KEY (401)");
  }
  if (!res.ok) {
    throw new Error(`verify.mn session create failed (${res.status})`);
  }

  const session = (await res.json()) as VerifyMnSession;

  const admin = createAdminClient();
  if (admin) {
    // Register/reset can't proceed without this row, so a silent store
    // failure would let the user pay for an SMS that leads nowhere.
    const { error } = await admin.from("verify_mn_sessions").insert({
      session_id: session.sessionId,
      callback_token: callbackToken,
      phone: session.phone,
      user_id: opts.userId ?? null,
      expires_at: session.expiresAt,
    });
    if (error) {
      throw new Error(`verify.mn session store failed: ${error.message}`);
    }
  }

  return session;
}

/** Re-fetch the authoritative session status. Returns null on 404. */
export async function getVerificationStatus(
  sessionId: string,
  retried = false,
): Promise<VerifyMnSessionStatus | null> {
  const res = await fetch(
    `${VERIFY_MN_BASE}/sessions/${encodeURIComponent(sessionId)}`,
  );
  if (res.status === 404) return null;
  if (res.status === 429 && !retried) {
    // Polled too fast — back off one interval and try exactly once more.
    await sleep(POLL_INTERVAL_MS);
    return getVerificationStatus(sessionId, true);
  }
  if (!res.ok) {
    throw new Error(`verify.mn status check failed (${res.status})`);
  }
  return (await res.json()) as VerifyMnSessionStatus;
}

/** Persist a fetched status; on VERIFIED also flag the linked profile. */
export async function recordVerificationStatus(
  status: VerifyMnSessionStatus,
): Promise<void> {
  const { sessionId } = status;
  const verified = status.sessionStatus === "VERIFIED";

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("verify_mn_sessions")
      .update({
        status: status.sessionStatus,
        // verify.mn doesn't always return verifiedAt — stamp our own so the
        // register/reset freshness check has something to work with.
        verified_at: verified
          ? (status.verifiedAt ?? new Date().toISOString())
          : status.verifiedAt,
      })
      .eq("session_id", sessionId);

    if (verified) {
      const { data } = await admin
        .from("verify_mn_sessions")
        .select("user_id, phone")
        .eq("session_id", sessionId)
        .maybeSingle();
      const row = data as { user_id: string | null; phone: string } | null;
      if (row?.user_id) {
        await admin
          .from("profiles")
          .update({ phone: row.phone, phone_verified: true })
          .eq("id", row.user_id);
        // Phone-passcode accounts sign in via a synthetic email derived from
        // the phone, so a phone change must move that email too.
        const { data: u } = await admin.auth.admin.getUserById(row.user_id);
        if (isPhoneEmail(u?.user?.email)) {
          await admin.auth.admin.updateUserById(row.user_id, {
            email: phoneEmail(row.phone),
            email_confirm: true,
          });
        }
      }
    }
  }
}

/** Resolve the sessionId behind a callback token (null if unknown / no DB). */
export async function findSessionByCallbackToken(
  token: string,
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("verify_mn_sessions")
    .select("session_id")
    .eq("callback_token", token)
    .maybeSingle();
  return (data as { session_id: string } | null)?.session_id ?? null;
}

/**
 * Callback / poll handler half: confirm the status upstream (never trust the
 * unauthenticated callback ping itself) and record the result.
 */
export async function confirmVerification(sessionId: string): Promise<boolean> {
  const status = await getVerificationStatus(sessionId);
  if (!status) return false;
  await recordVerificationStatus(status);
  return status.sessionStatus === "VERIFIED";
}

/**
 * Verify a phone end to end: open a session, then poll until the user's SMS
 * arrives or the session's TTL (~300s) runs out. Resolves true only once
 * verify.mn reports VERIFIED. Blocks for up to the session lifetime — callers
 * that can't wait should use createVerificationSession + the callback route.
 */
export async function verifyPhone(
  phone: string,
  opts: { userId?: string } = {},
): Promise<boolean> {
  const session = await createVerificationSession(phone, opts);
  const deadline = new Date(session.expiresAt).getTime();

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getVerificationStatus(session.sessionId);
    if (!status) return false;
    if (status.sessionStatus === "VERIFIED") {
      await recordVerificationStatus(status);
      return true;
    }
    if (status.sessionStatus === "EXPIRED") {
      await recordVerificationStatus(status);
      return false;
    }
  }
  return false;
}
