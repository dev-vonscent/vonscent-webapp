import { Card, CardContent } from "@/components/ui/card";

/**
 * The catalogue is the screen an operator opens most, and it now carries stock
 * as well as price — so it fetches more than any other list. The shared admin
 * spinner (`admin/loading.tsx`) gave a blank centre for that whole wait; this
 * holds the page's real shape instead, so the toolbar and rows do not jump
 * into place.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Бараа ачаалж байна">
      <div className="space-y-2">
        <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
        <div className="bg-muted/60 h-4 w-full max-w-prose animate-pulse rounded-md" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="bg-muted h-11 w-56 animate-pulse rounded-md md:h-9" />
        <div className="bg-muted h-11 w-40 animate-pulse rounded-md md:h-9" />
        <div className="bg-muted h-11 w-44 animate-pulse rounded-md md:h-9" />
      </div>
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="bg-muted size-12 shrink-0 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-4 flex-1 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-4 w-20 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-6 w-16 animate-pulse rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
