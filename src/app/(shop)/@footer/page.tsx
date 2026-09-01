import { SiteFooter } from "@/components/shared/site-footer";

/** Matches `/` only — the home page is the one place the footer belongs. */
export default function FooterSlot() {
  return <SiteFooter />;
}
