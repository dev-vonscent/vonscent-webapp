/** Step 4 — GET /v2/invoice/{invoice_id}. Shows the invoice's current status. */
import { getInvoice } from "../client.js";
import { dumpJson, heading, resolveInvoiceId, run } from "./_shared.js";

run(async () => {
  heading("4. Нэхэмжлэх харах — GET /invoice/{id}");

  const invoiceId = resolveInvoiceId();
  const invoice = await getInvoice(invoiceId);

  console.log(`invoice_id        : ${invoice.invoice_id}`);
  console.log(`invoice_status    : ${invoice.invoice_status}`);
  console.log(`sender_invoice_no : ${invoice.sender_invoice_no}`);
  console.log(`total_amount      : ${invoice.total_amount}`);
  console.log(`transactions      : ${invoice.transactions?.length ?? 0}`);

  dumpJson("Түүхий хариулт", invoice);
});
