import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Invoice from "../models/invoice.model.js";
import JournalEntry from "../models/journal-entry.model.js";
import { ACCOUNTS } from "../services/journal.service.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function diagnoseInvoices() {
  const invoices = await Invoice.find({ total: { $gt: 0 } })
    .select("_id invoiceNumber total")
    .lean();
  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));

  const journals = await JournalEntry.find({
    sourceEntity: "invoice",
    status: "posted",
    "lines.accountCode": ACCOUNTS.REVENUE.code,
  }).select("entryNumber sourceId sourceNumber lines").lean();

  const journalRevenueBySource = new Map();
  for (const journal of journals) {
    const sourceId = String(journal.sourceId || "");
    const revenue = (journal.lines || [])
      .filter((line) => line.accountCode === ACCOUNTS.REVENUE.code)
      .reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

    if (!journalRevenueBySource.has(sourceId)) {
      journalRevenueBySource.set(sourceId, {
        sourceId,
        sourceNumber: journal.sourceNumber || "",
        journalTotal: 0,
        entries: [],
      });
    }
    const row = journalRevenueBySource.get(sourceId);
    row.journalTotal = round(row.journalTotal + revenue);
    row.entries.push(journal.entryNumber);
  }

  const orphanJournals = [];
  const mismatchedInvoices = [];
  const missingJournals = [];

  for (const [sourceId, row] of journalRevenueBySource.entries()) {
    const invoice = invoiceById.get(sourceId);
    if (!invoice) {
      orphanJournals.push({
        sourceId,
        sourceNumber: row.sourceNumber,
        journalTotal: row.journalTotal,
        entries: row.entries.join(", "),
      });
      continue;
    }

    const sourceTotal = round(invoice.total);
    const delta = round(sourceTotal - row.journalTotal);
    if (Math.abs(delta) >= 0.01) {
      mismatchedInvoices.push({
        invoiceId: sourceId,
        invoiceNumber: invoice.invoiceNumber,
        sourceTotal,
        journalTotal: row.journalTotal,
        delta,
        entries: row.entries.join(", "),
      });
    }
  }

  for (const invoice of invoices) {
    if (!journalRevenueBySource.has(String(invoice._id))) {
      missingJournals.push({
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        sourceTotal: round(invoice.total),
      });
    }
  }

  return { orphanJournals, mismatchedInvoices, missingJournals };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to diagnose accounting.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const result = await diagnoseInvoices();
  console.log("Invoice journal orphans:");
  console.table(result.orphanJournals);
  console.log("Invoice total mismatches:");
  console.table(result.mismatchedInvoices);
  console.log("Invoices missing journals:");
  console.table(result.missingJournals);

  if (result.orphanJournals.length || result.mismatchedInvoices.length || result.missingJournals.length) {
    throw new Error("Accounting diagnostics found invoice journal issues.");
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log("accounting diagnostics passed");
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
