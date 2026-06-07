import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import { buildAccountingReconciliation } from "../services/accounting-reconciliation.service.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to reconcile accounting.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  const report = await buildAccountingReconciliation();
  const checks = report.checks.map((check) => ({ ...check, ok: check.status === "pass" }));

  console.table(checks.map(({ name, source, journal, delta, ok }) => ({ name, source, journal, delta, ok })));

  if (report.status !== "pass") {
    throw new Error(`${report.totals.failed} accounting reconciliation check(s) failed.`);
  }

  console.log("accounting reconciliation passed");
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
