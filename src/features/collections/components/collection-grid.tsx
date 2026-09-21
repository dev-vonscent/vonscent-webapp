import type { ReactNode } from "react";
import { CollectionCard } from "./collection-card";
import type { Collection } from "../types";

/** Poster-led grid — one big card per row on phones, up to three on desktop.
 * `trailing` нь жагсаалтын сүүлчийн нүд (одоогоор «Өөрөө угсрах»). */
export function CollectionGrid({
  collections,
  giftPoolEnabled = false,
  trailing,
}: {
  collections: Collection[];
  giftPoolEnabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((c) => (
        <CollectionCard
          key={c.id}
          collection={c}
          giftPoolEnabled={giftPoolEnabled}
        />
      ))}
      {trailing}
    </div>
  );
}
