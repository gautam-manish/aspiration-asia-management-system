import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Invoice from "../models/invoice.model.js";
import { createLockedInvoiceConversion } from "../services/exchange-rate.service.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const CONFIRM_TEXT = "BACKFILL INVOICE NPR";

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  const applyChanges = process.env.CONFIRM_INVOICE_NPR_BACKFILL === CONFIRM_TEXT;

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const invoices = await Invoice.find({
    $or: [
      { exchangeRateToNpr: { $exists: false } },
      { exchangeRateToNpr: { $lte: 0 } },
      { nprTotal: { $exists: false } },
    ],
  }).sort({ invoiceDate: 1, createdAt: 1 });

  if (invoices.length === 0) {
    console.log("All invoices already have locked NPR conversions.");
    return;
  }

  console.log(`${applyChanges ? "Applying" : "Dry run for"} ${invoices.length} invoice NPR conversion(s).`);
  for (const invoice of invoices) {
    const conversion = await createLockedInvoiceConversion({
      currency: invoice.currency || invoice.currencyCode,
      invoiceDate: invoice.invoiceDate,
      total: invoice.total,
    });
    console.log([
      invoice.invoiceNumber,
      conversion.currencyCode,
      `rate=${conversion.exchangeRateToNpr}`,
      `rateDate=${conversion.exchangeRateDate}`,
      `NPR=${conversion.nprTotal}`,
    ].join(" | "));
    if (applyChanges) {
      Object.assign(invoice, conversion);
      await invoice.save();
    }
  }

  if (!applyChanges) {
    console.log(`Dry run only. Set CONFIRM_INVOICE_NPR_BACKFILL="${CONFIRM_TEXT}" to save changes.`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Invoice NPR backfill completed.");
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
