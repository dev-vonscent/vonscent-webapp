import { fetchCustomTags } from "@/features/taxonomy/api";
import { CustomTagManager } from "@/features/admin/components/custom-tag-manager";

export const dynamic = "force-dynamic";

/**
 * Нэмэлт таг-ийн сан (A2): free-form internal tags. Products pick from this
 * pool; search matches on them; the quiz will consume them once the client
 * supplies the tag list (questions.md №27).
 */
export default async function AdminTagsPage() {
  const tags = await fetchCustomTags();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Нэмэлт таг</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Дотоод таг-ууд — хэрэглэгчид badge болж харагдахгүй, харин хайлт
          болон үнэрээ олох quiz-д ашиглагдана. Бараа нэмэх/засах форм дээрээс
          сонгоно.
        </p>
      </div>
      <CustomTagManager tags={tags} />
    </div>
  );
}
