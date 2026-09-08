/** Step 5 — DELETE /v2/invoice/{invoice_id}. Cleans up the test invoice. */
import { cancelInvoice } from "../client.js";
import { dumpJson, heading, resolveInvoiceId, run } from "./_shared.js";

run(async () => {
  heading("5. Нэхэмжлэх цуцлах — DELETE /invoice/{id}");

  const invoiceId = resolveInvoiceId();
  const result = await cancelInvoice(invoiceId);

  console.log(`\n✓ ${invoiceId} цуцлагдлаа.`);
  console.log(`  Төлөгдсөн нэхэмжлэхийг цуцлах боломжгүй — алдаа буцаана.`);

  dumpJson("Түүхий хариулт", result);
});
