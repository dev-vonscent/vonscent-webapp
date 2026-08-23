import "server-only";
import sanitize from "sanitize-html";

/**
 * HTML sanitizer for admin-authored rich text (TipTap output). The editor is
 * staff-only, but stored HTML still passes through here before
 * dangerouslySetInnerHTML — one hijacked admin account must not become stored
 * XSS for every visitor. Server-only (sanitize-html); client components get
 * pre-sanitized HTML from their server parents.
 */

const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "code",
    "pre",
    "hr",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, OPTIONS);
}

/** Rich-text vs legacy plain text: TipTap output always starts with a tag. */
export function isRichText(value: string): boolean {
  return /^\s*</u.test(value);
}

/** Strips tags for places that need plain text (search, JSON-LD, excerpts). */
export function htmlToText(html: string): string {
  return sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/gu, " ")
    .trim();
}
