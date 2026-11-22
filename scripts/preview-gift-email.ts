/**
 * Бэлгийн картын имэйлийг HTML файл болгож урьдчилан харах (локал).
 *
 *   node --import tsx scripts/preview-gift-email.ts <token> <out.html>
 */
import { writeFileSync } from "node:fs";
import { renderEmail } from "../src/lib/email/layout";
import { recipientEmail } from "../src/features/gift-cards/email-docs";

const [token = "a".repeat(32), out = "gift-email.html"] = process.argv.slice(2);
const { subject, doc } = recipientEmail(
  {
    token,
    amount: 200000,
    from_name: "Болд",
    recipient_name: "Сараа",
    message: "Төрсөн өдрийн мэнд! Өөрт тохирох үнэрээ олоорой.",
    code: "VON-7K4P-Q9XM",
    expires_at: new Date(Date.now() + 365 * 86400e3).toISOString(),
  },
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
);
writeFileSync(out, renderEmail(doc).html);
console.log(`${subject}\n→ ${out}`);
