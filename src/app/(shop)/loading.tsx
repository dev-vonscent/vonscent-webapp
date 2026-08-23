export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Ачаалж байна"
    >
      <div className="border-muted-foreground/30 border-t-foreground size-8 animate-spin rounded-full border-2" />
    </div>
  );
}
