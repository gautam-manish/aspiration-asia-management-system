import CustomerPayment from "../models/customer-payment.model.js";
import Invoice from "../models/invoice.model.js";
import JournalEntry from "../models/journal-entry.model.js";
import OfficeExpense from "../models/office-expense.model.js";
import VendorBill from "../models/vendor-bill.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import { ACCOUNTS } from "./journal.service.js";

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function sourceTotal(Model, match, field) {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return round(row?.total || 0);
}

async function journalTotal({ sourceEntity, accountCode, side }) {
  const [row] = await JournalEntry.aggregate([
    { $match: { sourceEntity, status: "posted" } },
    { $unwind: "$lines" },
    { $match: { "lines.accountCode": accountCode } },
    { $group: { _id: null, total: { $sum: `$lines.${side}` } } },
  ]);
  return round(row?.total || 0);
}

function compare(name, source, journal, group) {
  const delta = round(source - journal);
  return {
    name,
    group,
    source,
    journal,
    delta,
    status: Math.abs(delta) < 0.01 ? "pass" : "fail",
  };
}

export async function buildAccountingReconciliation() {
  const invoiceRevenue = await sourceTotal(Invoice, { total: { $gt: 0 } }, "total");
  const customerPayments = await sourceTotal(CustomerPayment, { status: "posted", amount: { $gt: 0 } }, "amount");
  const vendorBills = await sourceTotal(VendorBill, { status: { $ne: "void" }, total: { $gt: 0 } }, "total");
  const vendorPayments = await sourceTotal(VendorPayment, { status: "posted", amount: { $gt: 0 } }, "amount");
  const officeExpenses = await sourceTotal(OfficeExpense, { status: "posted", amount: { $gt: 0 } }, "amount");

  const checks = [
    compare("Invoice revenue", invoiceRevenue, await journalTotal({ sourceEntity: "invoice", accountCode: ACCOUNTS.REVENUE.code, side: "credit" }), "Revenue"),
    compare("Invoice receivable", invoiceRevenue, await journalTotal({ sourceEntity: "invoice", accountCode: ACCOUNTS.AR.code, side: "debit" }), "Receivable"),
    compare("Customer payment cash", customerPayments, await journalTotal({ sourceEntity: "customer-payment", accountCode: ACCOUNTS.CASH.code, side: "debit" }), "Cash"),
    compare("Customer payment AR", customerPayments, await journalTotal({ sourceEntity: "customer-payment", accountCode: ACCOUNTS.AR.code, side: "credit" }), "Receivable"),
    compare("Vendor bill cost", vendorBills, await journalTotal({ sourceEntity: "vendor-bill", accountCode: ACCOUNTS.DIRECT_COST.code, side: "debit" }), "Cost"),
    compare("Vendor bill payable", vendorBills, await journalTotal({ sourceEntity: "vendor-bill", accountCode: ACCOUNTS.AP.code, side: "credit" }), "Payable"),
    compare("Vendor payment AP", vendorPayments, await journalTotal({ sourceEntity: "vendor-payment", accountCode: ACCOUNTS.AP.code, side: "debit" }), "Payable"),
    compare("Vendor payment cash", vendorPayments, await journalTotal({ sourceEntity: "vendor-payment", accountCode: ACCOUNTS.CASH.code, side: "credit" }), "Cash"),
    compare("Office expense", officeExpenses, await journalTotal({ sourceEntity: "office-expense", accountCode: ACCOUNTS.OFFICE_EXPENSE.code, side: "debit" }), "Expense"),
    compare("Office expense cash", officeExpenses, await journalTotal({ sourceEntity: "office-expense", accountCode: ACCOUNTS.CASH.code, side: "credit" }), "Cash"),
  ];

  const failed = checks.filter((check) => check.status === "fail");
  return {
    generatedAt: new Date().toISOString(),
    status: failed.length ? "fail" : "pass",
    totals: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      absoluteDelta: round(checks.reduce((sum, check) => sum + Math.abs(check.delta), 0)),
    },
    checks,
  };
}
