import { CollectionCard } from "./collection-card";
import type { Collection } from "../types";

/** Poster-led grid — one big card per row on phones, up to three on desktop. */
export function CollectionGrid({ collections }: { collections: Collection[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((c) => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  );
}
