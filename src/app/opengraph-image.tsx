import { ogCard, OG_SIZE } from "@/lib/og";
import { SITE } from "@/lib/constants";

export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SITE.name;

/** Site-wide fallback OG card — pages without their own image inherit this. */
export default async function Image() {
  return ogCard({
    title: SITE.tagline,
    subtitle: SITE.description,
  });
}
