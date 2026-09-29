import Link from "next/link";
import { Ticket } from "lucide-react";

/**
 * Зочинд купон, V point-ын оронд гарах нэг мөр (0104: хоёулаа зөвхөн
 * бүртгэлтэй хэрэглэгчид).
 *
 * Modal ч биш, товч ч биш — зочноор захиалах нь энэ хуудасны гол зам хэвээр.
 * Купонтой хүн л үүнийг хайж байгаа, тэр хүнд «хаана оруулах вэ» гэдэг
 * асуултын хариу нь яг купоны талбар байх ёстой байсан газарт байна. Холбоос
 * нь `?next=/checkout`-тэй тул нэвтэрсний дараа сагс, бөглөсөн маягтаараа
 * буцаж ирнэ.
 */
export function GuestPerksPrompt({
  href,
  onNavigate,
}: {
  href: string;
  /** Маягтын ноорогийг хадгалах (checkout-ын `keepDraft`). */
  onNavigate?: () => void;
}) {
  return (
    <p className="bg-secondary text-muted-foreground flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs">
      <Ticket className="size-4 shrink-0" />
      <span>
        Купон, V point ашиглах бол{" "}
        <Link
          href={href}
          onClick={onNavigate}
          className="text-foreground font-semibold underline underline-offset-2"
        >
          нэвтэрнэ үү
        </Link>
        .
      </span>
    </p>
  );
}
