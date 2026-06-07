import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Invoice from "../models/invoice.model.js";
import JournalEntry from "../models/journal-entry.model.js";
import { ACCOUNTS, postInvoiceJournal } from "../services/journal.service.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const CONFIRM_TEXT = "REPAIR INVOICE JOURNALS";
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function findMismatchedInvoices() {
  const invoices = await Invoice.find({ total: { $gt: 0 } }).lean();
  const mismatches = [];

  for (const invoice of invoices) {
    const journals = await JournalEntry.find({
      sourceEntity: "invoice",
      sourceId: String(invoice._id),
      status: "posted",
      sourceAction: "post",
      "lines.accountCode": ACCOUNTS.REVENUE.code,
    }).lean();

    const journalTotal = round(journals.reduce((sum, journal) => {
      return sum + (journal.lines || [])
        .filter((line) => line.accountCode === ACCOUNTS.REVENUE.code)
        .reduce((lineSum, line) => lineSum + (Number(line.credit) || 0), 0);
    }, 0));
    const sourceTotal = round(invoice.total);
    const delta = round(sourceTotal - journalTotal);

    if (journals.length === 0 || Math.abs(delta) >= 0.01) {
      mismatches.push({ invoice, sourceTotal, journalTotal, delta, journalCount: journals.length });
    }
  }

  return mismatches;
}

async function main() {
  if (process.env.CONFIRM_REPAIR_JOURNALS !== CONFIRM_TEXT) {
    throw new Error(`Set CONFIRM_REPAIR_JOURNALS="${CONFIRM_TEXT}" to repair invoice journals.`);
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to repair invoice journals.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const mismatches = await findMismatchedInvoices();
  if (mismatches.length === 0) {
    console.log("No invoice journal mismatches found.");
    return;
  }

  console.table(mismatches.map(({ invoice, sourceTotal, journalTotal, delta, journalCount }) => ({
    invoiceId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    sourceTotal,
    journalTotal,
    delta,
    journalCount,
  })));

  for (const { invoice } of mismatches) {
    await postInvoiceJournal(invoice, { username: "system-repair", role: "admin" });
    console.log(`repaired invoice journal: ${invoice.invoiceNumber || invoice._id}`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log("invoice journal repair completed");
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
