import { PageSpinner } from "@/components/shared/skeletons";

/**
 * Catch-all for admin screens with no shape-specific skeleton. The heavy
 * lists — бараа, захиалга, хэрэглэгч, үлдэгдэл — each override it.
 */
export default function Loading() {
  return <PageSpinner />;
}
