import type { Metadata } from "next";
import { SITE } from "@/lib/constants";

/**
 * Canonical + og:url for a public, indexable page. `path` is relative to
 * metadataBase (SITE.url), without query — so filtered/sorted catalog URLs
 * all fold into one canonical. openGraph replaces the parent's object rather
 * than merging, so type/siteName/locale are repeated here and the site-wide
 * og:image (SITE.ogImage, a static file in public/) has to be named again — except for a
 * segment with its own opengraph-image file (`ownImage`), where an explicit
 * image would win over that file.
 *
 * `title` is the page's own title: it becomes `<title>` (through the root
 * `· Von Scent` template) and og:title *without* that suffix — Telegram and
 * Messenger already print og:site_name / the domain above it, so the share
 * card would otherwise repeat the brand. og:description is left for Next to
 * fill from the page's description.
 */
export function pageMetadata(
  path: string,
  {
    title,
    ownImage = false,
  }: { title?: string; ownImage?: boolean } = {},
): Metadata {
  return {
    ...(title ? { title } : {}),
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.brandName,
      locale: "mn_MN",
      url: path,
      ...(title ? { title } : {}),
      ...(ownImage ? {} : { images: { ...SITE.ogImage, alt: SITE.brandName } }),
    },
  };
}
