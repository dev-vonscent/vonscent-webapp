import { revalidatePath } from "next/cache";

/**
 * Purge every cached public page (ISR). Admin mutation routes call this after
 * a successful write so storefront pages pick up the change on the next hit
 * instead of waiting out their `revalidate` window.
 */
export function revalidatePublic() {
  revalidatePath("/", "layout");
}
