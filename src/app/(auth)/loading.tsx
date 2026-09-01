import { Spinner } from "@/components/shared/skeletons";

/**
 * Нэвтрэх / Бүртгүүлэх / Нууц үг сэргээх.
 *
 * These had no boundary at all, so the whole animated backdrop had to compile
 * and stream before anything appeared. A card-shaped skeleton would fight that
 * backdrop, so this is just a spinner centred in the same full-height frame the
 * auth layout uses.
 */
export default function Loading() {
  return (
    <div
      className="text-muted-foreground flex min-h-svh items-center justify-center"
      role="status"
      aria-label="Ачаалж байна"
    >
      <Spinner />
    </div>
  );
}
