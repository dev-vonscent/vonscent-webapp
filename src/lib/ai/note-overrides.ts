import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteOverrides } from "./notes-en";

/**
 * Admin-filled note translations (`note_translations`, 0102) as a lookup for
 * `pickNotes` / `untranslatedNotes`.
 *
 * Takes the client rather than creating one so the batch script
 * (`scripts/gen-note-images.ts`) can share it. Never throws: without the table
 * (0102 not applied yet) or on a read error the inlined table alone still
 * works, which is exactly the behaviour before 0102.
 */
export async function loadNoteOverrides(
  supabase: SupabaseClient,
): Promise<NoteOverrides> {
  const { data, error } = await supabase
    .from("note_translations")
    .select("mn, en, is_abstract");
  if (error || !data) return new Map();
  return new Map(
    (data as { mn: string; en: string; is_abstract: boolean }[]).map((r) => [
      r.mn,
      { en: r.en, isAbstract: r.is_abstract },
    ]),
  );
}
