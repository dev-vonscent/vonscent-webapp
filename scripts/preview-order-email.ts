/**
 * Захиалгын имэйлийг («Захиалга хүлээн авлаа» / «Захиалга баталгаажлаа»)
 * HTML файл болгож урьдчилан харах (локал). Сангаас (`.env.dev`) зөвхөн
 * уншина — ИЛГЭЭХГҮЙ.
 *
 *   node --env-file=.env.dev --import ./scripts/stub-server-only.mjs \
 *     --import tsx \
 *     scripts/preview-order-email.ts <orderId> <out.html> [placed|paid]
 *
 * `stub-server-only.mjs` нь `server-only`-г хоосон модуль болгоно.
 */
import { writeFileSync } from "node:fs";
import { buildOrderCustomerEmail } from "../src/lib/notify/customer-email";

const [orderId, out = "order-email.html", kind = "paid"] =
  process.argv.slice(2);
if (!orderId || (kind !== "placed" && kind !== "paid")) {
  console.error(
    "usage: preview-order-email.ts <orderId> <out.html> [placed|paid]",
  );
  process.exit(1);
}

async function main(orderId: string, kind: "placed" | "paid") {
  const mail = await buildOrderCustomerEmail(orderId, kind, {
    // Хүлээн авагчийг сангаас хайхгүй — имэйлгүй (зочин) захиалгыг ч харна.
    recipient: { email: "preview@localhost" },
  });
  if (!mail) {
    console.error("Захиалга олдсонгүй (эсвэл бэлгийн картын захиалга).");
    process.exit(1);
  }
  writeFileSync(out, mail.html);
  writeFileSync(out.replace(/\.html?$/, "") + ".txt", mail.text);
  console.log(`${mail.subject}\n→ ${out}`);
}

void main(orderId, kind);
