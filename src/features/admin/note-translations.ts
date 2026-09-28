import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadNoteOverrides } from "@/lib/ai/note-overrides";
import { untranslatedNotes } from "@/lib/ai/notes-en";

/**
 * Барааны нотуудаас англи нэргүйг нь (кодын хүснэгт болон
 * `note_translations`-д аль алинд нь байхгүй) буцаана — засах хуудасны самбар.
 * `note_translations` RLS-ээр хаалттай тул service role-оор уншина.
 */
export async function getUntranslatedNotes(tiers: {
  top: string[];
  heart: string[];
  base: string[];
}): Promise<string[]> {
  const supabase = createAdminClient();
  const overrides = supabase ? await loadNoteOverrides(supabase) : undefined;
  return untranslatedNotes(tiers, overrides);
}
