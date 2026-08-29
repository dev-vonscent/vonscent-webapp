"use client";

import * as React from "react";

/**
 * Carry the product list's filters through the edit page and back.
 *
 * Saving used to `router.push("/admin/products")`, which dropped `?q/status/
 * sort`. An operator working a `status=low&sort=stock` list re-applied the
 * filter after every single product — ten fixes, ten re-filters. `router.back()`
 * would only work when the operator actually arrived from the list, so the
 * query travels in the URL instead and survives a refresh or a shared link.
 */
export const RETURN_PARAM = "from";

/** `/admin/products/<id>/edit?from=status%3Dlow%26sort%3Dstock` */
export function editHref(productId: string, currentSearch: string): string {
  const base = `/admin/products/${productId}/edit`;
  const search = currentSearch.replace(/^\?/, "");
  return search
    ? `${base}?${RETURN_PARAM}=${encodeURIComponent(search)}`
    : base;
}

/** Where «Болих» and a successful save should land. */
export function listHref(from: string | null | undefined): string {
  return from ? `/admin/products?${from}` : "/admin/products";
}

/**
 * Warn before the browser discards a half-typed form. Covers refresh, tab
 * close and back; in-app navigation is guarded by the form's own «Болих»
 * confirmation, since the App Router exposes no navigation interception.
 */
export function useUnsavedGuard(dirty: boolean): void {
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers show their own wording; a non-empty returnValue is what
      // actually triggers the prompt in older engines.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
