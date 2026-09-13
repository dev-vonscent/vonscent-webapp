import { fetchCustomTags } from "@/features/taxonomy/api";
import { CustomTagManager } from "@/features/admin/components/custom-tag-manager";
import { PageHeader } from "@/components/shared/page-header";

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
      <PageHeader
        title="Нэмэлт таг"
      />
      <CustomTagManager tags={tags} />
    </div>
  );
}
