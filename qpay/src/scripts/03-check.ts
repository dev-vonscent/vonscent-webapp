/**
 * Step 3 — POST /v2/payment/check
 *
 * This is the call that decides whether an order is really paid. In production
 * it runs after the callback fires, and `paid_amount` is compared against the
 * server-computed order total before anything is marked paid.
 */
import { checkPayment } from "../client.js";
import { dumpJson, heading, resolveInvoiceId, run } from "./_shared.js";

run(async () => {
  heading("3. Төлбөр шалгах — POST /payment/check");

  const invoiceId = resolveInvoiceId();
  console.log(`object_type : INVOICE`);
  console.log(`object_id   : ${invoiceId}`);

  const result = await checkPayment(invoiceId);

  console.log(`\ncount       : ${result.count}`);
  console.log(`paid_amount : ${result.paid_amount ?? 0}`);

  if (result.count === 0) {
    console.log(
      `\n✓ Төлөгдөөгүй байна. Тест төлбөр хийгээгүй тул энэ нь \x1b[1mЗӨВ\x1b[0m үр дүн.`,
    );
    console.log(
      `  Production-д: count 0 бол захиалгыг төлөгдсөн гэж ТЭМДЭГЛЭХГҮЙ.`,
    );
  } else {
    console.log(`\n✓ ${result.count} гүйлгээ олдлоо:`);
    for (const row of result.rows) {
      console.log(
        `  • ${row.payment_id} | ${row.payment_status} | ${row.payment_amount}₮ | ${row.payment_wallet ?? "-"} | ${row.payment_date ?? "-"}`,
      );
    }
    const paidRows = result.rows.filter((r) => r.payment_status === "PAID");
    console.log(
      `\n  PAID статустай: ${paidRows.length}. Захиалгыг баталгаажуулахдаа paid_amount-ыг серверийн тооцоолсон дүнтэй тулгана.`,
    );
  }

  dumpJson("Түүхий хариулт", result);
});
