import JournalEntry from "../models/journal-entry.model.js";
import Invoice from "../models/invoice.model.js";
import { convertAmountToNpr, getStoredInvoiceNprRate, getStoredInvoiceNprTotal } from "./exchange-rate.service.js";

export const ACCOUNTS = {
  AR: { code: "1100", name: "Accounts Receivable" },
  CASH: { code: "1000", name: "Cash / Bank" },
  REVENUE: { code: "4000", name: "Sales Revenue" },
  AP: { code: "2100", name: "Accounts Payable" },
  DIRECT_COST: { code: "5000", name: "Direct Cost" },
  OFFICE_EXPENSE: { code: "6100", name: "Office Expense" },
};

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function nextEntryNumber() {
  const d = new Date();
  const prefix = `JE${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await JournalEntry.countDocuments({ entryNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

function line(account, { debit = 0, credit = 0, partyId = null, partyName = "", bookingId = "", memo = "" } = {}) {
  return {
    accountCode: account.code,
    accountName: account.name,
    debit: round(debit),
    credit: round(credit),
    partyId,
    partyName,
    bookingId,
    memo,
  };
}

function actor(user = {}) {
  return {
    username: user.username || "",
    role: user.role || "",
  };
}

async function createEntry({ entryDate, sourceEntity, sourceId, sourceNumber = "", sourceAction = "post", reversalOf = null, memo = "", currency = "Rs.", lines, createdBy }) {
  const cleanLines = (lines || []).filter((item) => round(item.debit) > 0 || round(item.credit) > 0);
  const totals = cleanLines.reduce((acc, item) => {
    acc.debit += round(item.debit);
    acc.credit += round(item.credit);
    return acc;
  }, { debit: 0, credit: 0 });
  totals.debit = round(totals.debit);
  totals.credit = round(totals.credit);

  if (cleanLines.length < 2 || totals.debit <= 0 || totals.debit !== totals.credit) {
    throw new Error("Journal entry is not balanced");
  }

  return JournalEntry.create({
    entryNumber: await nextEntryNumber(),
    entryDate,
    sourceEntity,
    sourceId: String(sourceId || ""),
    sourceNumber,
    sourceAction,
    reversalOf,
    memo,
    currency,
    lines: cleanLines,
    totals,
    createdBy,
  });
}

async function reverseActiveEntries({ sourceEntity, sourceId, entryDate, memo = "", createdBy }) {
  const activeEntries = await JournalEntry.find({
    sourceEntity,
    sourceId: String(sourceId || ""),
    status: "posted",
    sourceAction: "post",
  });

  for (const entry of activeEntries) {
    await createEntry({
      entryDate,
      sourceEntity,
      sourceId,
      sourceNumber: entry.sourceNumber,
      sourceAction: "reversal",
      reversalOf: entry._id,
      memo: memo || `Reversal of ${entry.entryNumber}`,
      currency: entry.currency,
      lines: entry.lines.map((item) => ({
        ...item.toObject?.() ?? item,
        debit: round(item.credit),
        credit: round(item.debit),
      })),
      createdBy,
    });
    entry.status = "reversed";
    await entry.save();
  }
}

export async function replaceJournalEntry(payload) {
  const createdBy = actor(payload.user);
  await reverseActiveEntries({
    sourceEntity: payload.sourceEntity,
    sourceId: payload.sourceId,
    entryDate: payload.entryDate,
    memo: `Reversal before reposting ${payload.sourceNumber || payload.sourceEntity}`,
    createdBy,
  });

  return createEntry({ ...payload, createdBy });
}

export async function reverseJournalEntry(payload) {
  return reverseActiveEntries({
    sourceEntity: payload.sourceEntity,
    sourceId: payload.sourceId,
    entryDate: payload.entryDate,
    memo: payload.memo,
    createdBy: actor(payload.user),
  });
}

export async function postInvoiceJournal(invoice, user) {
  const total = round(getStoredInvoiceNprTotal(invoice));
  if (total <= 0) return null;
  const partyName = invoice.billTo?.name || "";
  return replaceJournalEntry({
    entryDate: invoice.invoiceDate || new Date().toISOString().slice(0, 10),
    sourceEntity: "invoice",
    sourceId: invoice._id,
    sourceNumber: invoice.invoiceNumber,
    memo: `Invoice ${invoice.invoiceNumber || ""}`.trim(),
    currency: "NPR",
    lines: [
      line(ACCOUNTS.AR, { debit: total, partyId: invoice.customerId, partyName, bookingId: invoice.bookingId }),
      line(ACCOUNTS.REVENUE, { credit: total, partyId: invoice.customerId, partyName, bookingId: invoice.bookingId }),
    ],
    user,
  });
}

export async function postCustomerPaymentJournal(payment, user) {
  const invoice = payment.invoiceId
    ? await Invoice.findById(payment.invoiceId).lean()
    : await Invoice.findOne({ invoiceNumber: String(payment.invoiceNumber || "").toUpperCase() }).lean();
  const amount = round(invoice
    ? convertAmountToNpr(payment.amount, getStoredInvoiceNprRate(invoice))
    : payment.amount);
  if (amount <= 0 || payment.status === "void") return null;
  const partyName = payment.customer?.name || "";
  return replaceJournalEntry({
    entryDate: payment.paymentDate || new Date().toISOString().slice(0, 10),
    sourceEntity: "customer-payment",
    sourceId: payment._id,
    sourceNumber: payment.paymentNumber || payment.referenceCode,
    memo: `Customer payment ${payment.paymentNumber || ""}`.trim(),
    currency: "NPR",
    lines: [
      line(ACCOUNTS.CASH, { debit: amount, partyId: payment.customerId, partyName, bookingId: payment.bookingId }),
      line(ACCOUNTS.AR, { credit: amount, partyId: payment.customerId, partyName, bookingId: payment.bookingId }),
    ],
    user,
  });
}

export async function postVendorBillJournal(bill, user) {
  const total = round(bill.total);
  if (total <= 0 || bill.status === "void") return null;
  const partyName = bill.vendor?.name || bill.vendor?.company || "";
  return replaceJournalEntry({
    entryDate: bill.billDate || new Date().toISOString().slice(0, 10),
    sourceEntity: "vendor-bill",
    sourceId: bill._id,
    sourceNumber: bill.billNumber,
    memo: `Vendor bill ${bill.billNumber || ""}`.trim(),
    currency: bill.currency || "Rs.",
    lines: [
      line(ACCOUNTS.DIRECT_COST, { debit: total, partyId: bill.vendorId, partyName, bookingId: bill.bookingId }),
      line(ACCOUNTS.AP, { credit: total, partyId: bill.vendorId, partyName, bookingId: bill.bookingId }),
    ],
    user,
  });
}

export async function postVendorPaymentJournal(payment, user) {
  const amount = round(payment.amount);
  if (amount <= 0 || payment.status === "void") return null;
  const partyName = payment.vendor?.name || payment.vendor?.company || "";
  return replaceJournalEntry({
    entryDate: payment.paymentDate || new Date().toISOString().slice(0, 10),
    sourceEntity: "vendor-payment",
    sourceId: payment._id,
    sourceNumber: payment.paymentNumber,
    memo: `Vendor payment ${payment.paymentNumber || ""}`.trim(),
    currency: "Rs.",
    lines: [
      line(ACCOUNTS.AP, { debit: amount, partyId: payment.vendorId, partyName, bookingId: payment.bookingId }),
      line(ACCOUNTS.CASH, { credit: amount, partyId: payment.vendorId, partyName, bookingId: payment.bookingId }),
    ],
    user,
  });
}

export async function postOfficeExpenseJournal(expense, user) {
  const amount = round(expense.amount);
  if (amount <= 0 || expense.status === "void") return null;
  return replaceJournalEntry({
    entryDate: expense.expenseDate || new Date().toISOString().slice(0, 10),
    sourceEntity: "office-expense",
    sourceId: expense._id,
    sourceNumber: expense.expenseNumber,
    memo: `Office expense ${expense.expenseNumber || ""}`.trim(),
    currency: "Rs.",
    lines: [
      line(ACCOUNTS.OFFICE_EXPENSE, { debit: amount, partyName: expense.paidTo, memo: expense.category }),
      line(ACCOUNTS.CASH, { credit: amount, partyName: expense.paidTo, memo: expense.paymentMethod }),
    ],
    user,
  });
}
