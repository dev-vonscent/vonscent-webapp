import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const VERIFIED_BADGE_LABEL = "Баталгаажсан гишүүн";

/**
 * «Миний мэдээлэл»-ийг бүрэн бөглөсөн гишүүний тэмдэг (туг `profile_info`).
 * Нөхцөл нь `profileCompletion(info).complete` — V point олгох нөхцөлтэй
 * адил (`profile_info_complete`, 0163). Дуудагч нөхцөлийг шалгана.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      role="img"
      aria-label={VERIFIED_BADGE_LABEL}
      className={cn("fill-foreground text-background shrink-0", className)}
    >
      <title>{VERIFIED_BADGE_LABEL}</title>
    </BadgeCheck>
  );
}
