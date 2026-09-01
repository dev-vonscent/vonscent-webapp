/**
 * Every shop route below `/` — deliberately empty.
 *
 * `default.tsx` alone is not enough: on a *soft* navigation Next keeps a slot's
 * previously rendered content when nothing in the slot matches the new URL, so
 * clicking Нүүр → Каталог left the home page's footer sitting under the
 * catalogue. Giving the slot a catch-all means every path matches something,
 * so the slot always re-renders — here, to nothing.
 */
export default function NoFooter() {
  return null;
}
