import { CollectionCard } from "./collection-card";
import type { Collection } from "../types";

/** Poster-led grid — one big card per row on phones, up to three on desktop. */
export function CollectionGrid({ collections }: { collections: Collection[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {collections.map((c) => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  );
}
