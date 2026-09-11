/**
 * The customer list's search filter: name OR phone, both partial.
 *
 * Phone was the missing half — an operator taking a call has the number, not
 * the spelling of the name. The digits are pulled out of whatever was typed
 * («9911 2233», «9911-2233», «+976 9911 2233») because `profiles.phone` holds
 * bare 8 digits, so a formatted number would otherwise match nobody.
 *
 * Pure and separate from `api.ts` (which is `server-only`) so the escaping
 * below can be tested without a database.
 */

/**
 * PostgREST `or=` takes ONE comma-separated string, so a comma, parenthesis
 * or quote inside the term would be read as filter syntax rather than as text.
 * The name half is therefore quoted, and the two characters that could break
 * out of those quotes are dropped; the phone half is digits only.
 *
 * Returns `null` when there is nothing to filter on, so the caller leaves the
 * query unfiltered instead of matching on an empty pattern.
 */
export function customerSearchFilter(search: string): string | null {
  const term = search.trim();
  if (!term) return null;
  const name = term.replace(/["\\]/gu, "");
  const digits = phoneDigits(term);
  const clauses: string[] = [];
  if (name) clauses.push(`full_name.ilike."%${name}%"`);
  if (digits) clauses.push(`phone.ilike."%${digits}%"`);
  return clauses.length ? clauses.join(",") : null;
}

/**
 * The digits of a typed number, as `profiles.phone` stores them: bare 8
 * digits with no country code. A pasted «+976…» keeps its 976 only when the
 * rest is too short to be a full number — then it is more likely part of the
 * number itself than a prefix.
 */
function phoneDigits(term: string): string {
  const digits = term.replace(/\D/gu, "");
  return digits.length > 8 && digits.startsWith("976")
    ? digits.slice(3)
    : digits;
}
