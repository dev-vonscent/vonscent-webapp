import { PageSpinner } from "@/components/shared/skeletons";

/**
 * Catch-all for shop routes that have no shape-specific skeleton of their own
 * (about, faq, contact, cart…). The busy routes — catalog, product, collections,
 * blog — each override this with a skeleton of their own layout.
 *
 * It used to draw a `border-2` ring spinner, which was invisible: globals.css
 * forces every border in the app to transparent, so this boundary showed a
 * blank half-screen for the whole wait.
 */
export default function Loading() {
  return <PageSpinner />;
}
