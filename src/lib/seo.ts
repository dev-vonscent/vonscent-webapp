import type { Metadata } from "next";
import { SITE } from "@/lib/constants";

/**
 * Canonical + og:url for a public, indexable page. `path` is relative to
 * metadataBase (SITE.url), without query — so filtered/sorted catalog URLs
 * all fold into one canonical. openGraph replaces the parent's object rather
 * than merging, so type/siteName/locale are repeated here and the site-wide
 * og:image (app/opengraph-image.tsx) has to be named again — except for a
 * segment with its own opengraph-image file (`ownImage`), where an explicit
 * image would win over that file. og:title/og:description are left for Next
 * to fill from the page's own title and description.
 */
export function pageMetadata(
  path: string,
  { ownImage = false }: { ownImage?: boolean } = {},
): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "mn_MN",
      url: path,
      ...(ownImage ? {} : { images: "/opengraph-image" }),
    },
  };
}
