import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { QpayError } from "../client.js";

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = resolve(here, "../../out");
export const LAST_INVOICE_PATH = resolve(OUT_DIR, "last-invoice.json");

export interface LastInvoice {
  invoiceId: string;
  senderInvoiceNo: string;
  amount: number;
  createdAt: string;
}

export function saveLastInvoice(data: LastInvoice): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LAST_INVOICE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

/** Invoice id from argv[2], falling back to the last one `pnpm invoice` created. */
export function resolveInvoiceId(): string {
  const fromArgv = process.argv[2];
  if (fromArgv) return fromArgv;
  try {
    const saved = JSON.parse(
      readFileSync(LAST_INVOICE_PATH, "utf8"),
    ) as LastInvoice;
    console.log(
      `ℹ  invoice_id-г ${LAST_INVOICE_PATH}-с авлаа (${saved.senderInvoiceNo})\n`,
    );
    return saved.invoiceId;
  } catch {
    throw new Error(
      "invoice_id алга. Эхлээд `pnpm invoice` ажиллуулна уу, эсвэл id-г аргументаар дамжуулна уу.",
    );
  }
}

export function heading(text: string): void {
  console.log(`\n\x1b[1m${text}\x1b[0m\n${"─".repeat(text.length)}`);
}

export function dumpJson(label: string, value: unknown): void {
  console.log(`\n\x1b[90m${label}:\x1b[0m`);
  console.log(JSON.stringify(value, null, 2));
}

/** Prints QPay failures readably instead of a raw stack trace, then exits 1. */
export function run(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    if (err instanceof QpayError) {
      console.error(`\n\x1b[31m✗ QPay алдаа (HTTP ${err.status})\x1b[0m`);
      console.error(`  endpoint: ${err.path}`);
      console.error(`  хариулт : ${JSON.stringify(err.body)}`);
      console.error(
        `\n  Дэлгэрэнгүй харах: DEBUG_QPAY=1 pnpm <script>`,
      );
    } else {
      console.error(
        `\n\x1b[31m✗ ${err instanceof Error ? err.message : String(err)}\x1b[0m`,
      );
    }
    process.exitCode = 1;
  });
}
