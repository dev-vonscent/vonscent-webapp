import { sanitizeHtml, isRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Renders admin-authored content: TipTap HTML is sanitized and rendered with
 * typography styles; legacy plain text (pre-editor posts, FAQ answers) keeps
 * the old blank-line-between-paragraphs convention.
 */
export function RichText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (isRichText(content)) {
    return (
      <div
        className={cn(
          "prose max-w-none",
          "prose-headings:font-serif prose-a:text-gold-strong prose-img:rounded-xl",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  const paragraphs = content.split(/\n\n+/u).filter(Boolean);
  return (
    <div className={cn("space-y-5 leading-relaxed", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
