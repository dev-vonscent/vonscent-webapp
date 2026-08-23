"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Site-wide toast outlet (sonner), themed to match the card surface. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-card-foreground !border-border !shadow-lift !rounded-xl",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
