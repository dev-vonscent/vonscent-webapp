/**
 * Step 2 — POST /v2/invoice
 *
 * Creates a real invoice, renders the QR in the terminal, and saves both the
 * PNG and the invoice id so the later scripts can pick it up.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import qrcode from "qrcode-terminal";
import { createInvoice } from "../client.js";
import { config } from "../config.js";
import { OUT_DIR, dumpJson, heading, run, saveLastInvoice } from "./_shared.js";

function renderQr(text: string): Promise<void> {
  return new Promise((res) => {
    qrcode.generate(text, { small: true }, (ascii: string) => {
      console.log(ascii);
      res();
    });
  });
}

run(async () => {
  heading("2. Нэхэмжлэх үүсгэх — POST /invoice");

  // QPay does NOT reject a repeated sender_invoice_no (verified) — a fresh one
  // per attempt is a merchant-side discipline, not an API guarantee.
  const senderInvoiceNo = `VS-TEST-${Date.now()}`;
  const amount = config.testAmount;

  console.log(`invoice_code      : ${config.invoiceCode}`);
  console.log(`sender_invoice_no : ${senderInvoiceNo}`);
  console.log(`amount            : ${amount}₮`);
  console.log(`callback_url      : ${config.callbackUrl}`);

  const invoice = await createInvoice({
    senderInvoiceNo,
    amount,
    description: `VONSCENT test ${senderInvoiceNo}`,
  });

  console.log(`\n✓ invoice_id: ${invoice.invoice_id}`);
  if (invoice.qPay_shortUrl) {
    console.log(`  богино холбоос: ${invoice.qPay_shortUrl}`);
  }

  if (invoice.qr_text) {
    console.log("\nQR (банкны аппаар уншуулж болно):\n");
    await renderQr(invoice.qr_text);
    console.log(`qr_text: ${invoice.qr_text}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  if (invoice.qr_image) {
    const pngPath = resolve(OUT_DIR, `qr-${invoice.invoice_id}.png`);
    const base64 = invoice.qr_image.replace(/^data:image\/png;base64,/, "");
    writeFileSync(pngPath, Buffer.from(base64, "base64"));
    console.log(`\n✓ qr_image хадгалагдлаа: ${pngPath}`);
  }

  const banks = invoice.urls ?? [];
  console.log(`\nБанк / wallet deeplink (${banks.length}):`);
  for (const bank of banks) {
    // Every link embeds the same qr_text; the scheme is the only useful part here.
    const scheme = bank.link.split("://")[0] ?? bank.link;
    console.log(`  • ${bank.name.padEnd(28)} ${scheme}://`);
  }

  saveLastInvoice({
    invoiceId: invoice.invoice_id,
    senderInvoiceNo,
    amount,
    createdAt: new Date().toISOString(),
  });
  console.log(`\n✓ out/last-invoice.json шинэчлэгдлээ.`);

  dumpJson("Түүхий хариулт (qr_image таслагдсан)", {
    ...invoice,
    qr_image: invoice.qr_image
      ? `<base64 png, ${invoice.qr_image.length} тэмдэгт>`
      : null,
  });

  console.log(
    `\nДараагийн алхам: \x1b[1mpnpm invoice:get\x1b[0m → \x1b[1mpnpm check\x1b[0m → \x1b[1mpnpm invoice:cancel\x1b[0m`,
  );
});
