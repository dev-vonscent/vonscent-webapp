import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  username: required("QPAY_USERNAME"),
  password: required("QPAY_PASSWORD"),
  invoiceCode: required("QPAY_INVOICE_CODE"),
  baseUrl: (
    process.env.QPAY_BASE_URL?.trim() || "https://merchant.qpay.mn/v2"
  ).replace(/\/+$/, ""),
  callbackUrl: required("QPAY_CALLBACK_URL"),
  testAmount: Number(process.env.QPAY_TEST_AMOUNT ?? 10),
  debug: process.env.DEBUG_QPAY === "1" || process.env.DEBUG_QPAY === "true",
} as const;

if (!Number.isFinite(config.testAmount) || config.testAmount <= 0) {
  throw new Error(`QPAY_TEST_AMOUNT must be a positive number.`);
}
