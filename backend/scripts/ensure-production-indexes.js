import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import AuditLog from "../models/audit-log.model.js";
import Booking from "../models/booking.model.js";
import CustomerPayment from "../models/customer-payment.model.js";
import Invoice from "../models/invoice.model.js";
import JournalEntry from "../models/journal-entry.model.js";
import OfficeExpense from "../models/office-expense.model.js";
import Sundry from "../models/sundry.model.js";
import VendorBill from "../models/vendor-bill.model.js";
import VendorPayment from "../models/vendor-payment.model.js";

const models = [
  AuditLog,
  Booking,
  CustomerPayment,
  Invoice,
  JournalEntry,
  OfficeExpense,
  Sundry,
  VendorBill,
  VendorPayment,
];

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to create production indexes.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  for (const model of models) {
    await model.createIndexes();
    console.log(`indexes ensured: ${model.modelName}`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log("production indexes are ready");
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
