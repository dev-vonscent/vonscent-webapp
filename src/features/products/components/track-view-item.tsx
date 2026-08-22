"use client";

import * as React from "react";
import { trackViewItem } from "@/lib/analytics";

/** Fires the GA4/Pixel view_item event once per PDP render (todo №25). */
export function TrackViewItem({
  id,
  name,
  brand,
  price,
}: {
  id: string;
  name: string;
  brand: string;
  price: number;
}) {
  React.useEffect(() => {
    trackViewItem({ id, name, brand, price });
  }, [id, name, brand, price]);
  return null;
}
