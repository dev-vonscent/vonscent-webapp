/**
 * The synthetic-email side of phone auth, split out of `phone.ts` so the
 * browser can use it too: `phone.ts` is server-only (it reaches for the
 * passcode pepper), but the account UI needs to know that
 * `99112233@phone.vonscent.mn` is a placeholder Supabase needs, not an address
 * to show anyone.
 */
export const PHONE_EMAIL_DOMAIN = "phone.vonscent.mn";

/** Synthetic Supabase email for a phone account. */
export function phoneEmail(phone: string): string {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPhoneEmail(email: string | undefined | null): boolean {
  return Boolean(email?.endsWith(`@${PHONE_EMAIL_DOMAIN}`));
}
