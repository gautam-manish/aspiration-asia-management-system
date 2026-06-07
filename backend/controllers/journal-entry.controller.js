import JournalEntry from "../models/journal-entry.model.js";
import Invoice from "../models/invoice.model.js";
import CustomerPayment from "../models/customer-payment.model.js";
import VendorBill from "../models/vendor-bill.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import OfficeExpense from "../models/office-expense.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import {
  postCustomerPaymentJournal,
  postInvoiceJournal,
  postOfficeExpenseJournal,
  postVendorBillJournal,
  postVendorPaymentJournal,
} from "../services/journal.service.js";

export const getJournalEntries = async (req, res) => {
  try {
    const { search = "", sourceEntity = "", sourceId = "", accountCode = "", status = "", from = "", to = "", page = 1, limit = 50 } = req.query;
    const filter = {};

    if (sourceEntity) filter.sourceEntity = String(sourceEntity);
    if (sourceId) filter.sourceId = String(sourceId);
    if (status && ["posted", "reversed"].includes(status)) filter.status = status;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = String(from);
      if (to) filter.entryDate.$lte = String(to);
    }
    if (accountCode) filter["lines.accountCode"] = String(accountCode);
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { entryNumber: { $regex: escaped, $options: "i" } },
        { sourceNumber: { $regex: escaped, $options: "i" } },
        { sourceEntity: { $regex: escaped, $options: "i" } },
        { memo: { $regex: escaped, $options: "i" } },
        { "lines.accountName": { $regex: escaped, $options: "i" } },
        { "lines.partyName": { $regex: escaped, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      JournalEntry.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      JournalEntry.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: entries,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getJournalEntries error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch journal entries.", data: null });
  }
};

async function hasJournal(sourceEntity, sourceId) {
  return JournalEntry.exists({ sourceEntity, sourceId: String(sourceId || "") });
}

async function backfillSource({ sourceEntity, records, postFn, user }) {
  const result = { sourceEntity, scanned: records.length, posted: 0, skipped: 0, failed: 0 };
  for (const record of records) {
    if (await hasJournal(sourceEntity, record._id)) {
      result.skipped += 1;
      continue;
    }
    try {
      const posted = await postFn(record, user);
      if (posted) result.posted += 1;
      else result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`journal backfill ${sourceEntity} failed for ${record._id}:`, error.message);
    }
  }
  return result;
}

export const backfillJournalEntries = async (req, res) => {
  try {
    const { sourceEntity = "", confirm = "" } = req.body || {};
    if (confirm !== "BACKFILL JOURNALS") {
      return res.status(400).json({
        success: false,
        message: "Type BACKFILL JOURNALS to confirm journal backfill.",
        data: null,
      });
    }

    const sources = [];

    if (!sourceEntity || sourceEntity === "invoice") {
      sources.push({
        sourceEntity: "invoice",
        records: await Invoice.find({ total: { $gt: 0 } }).lean(),
        postFn: postInvoiceJournal,
      });
    }
    if (!sourceEntity || sourceEntity === "customer-payment") {
      sources.push({
        sourceEntity: "customer-payment",
        records: await CustomerPayment.find({ status: "posted", amount: { $gt: 0 } }).lean(),
        postFn: postCustomerPaymentJournal,
      });
    }
    if (!sourceEntity || sourceEntity === "vendor-bill") {
      sources.push({
        sourceEntity: "vendor-bill",
        records: await VendorBill.find({ status: { $ne: "void" }, total: { $gt: 0 } }).lean(),
        postFn: postVendorBillJournal,
      });
    }
    if (!sourceEntity || sourceEntity === "vendor-payment") {
      sources.push({
        sourceEntity: "vendor-payment",
        records: await VendorPayment.find({ status: "posted", amount: { $gt: 0 } }).lean(),
        postFn: postVendorPaymentJournal,
      });
    }
    if (!sourceEntity || sourceEntity === "office-expense") {
      sources.push({
        sourceEntity: "office-expense",
        records: await OfficeExpense.find({ status: "posted", amount: { $gt: 0 } }).lean(),
        postFn: postOfficeExpenseJournal,
      });
    }

    if (sourceEntity && sources.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid journal backfill source.", data: null });
    }

    const results = [];
    for (const source of sources) {
      results.push(await backfillSource({ ...source, user: req.user }));
    }

    const totals = results.reduce((acc, item) => {
      acc.scanned += item.scanned;
      acc.posted += item.posted;
      acc.skipped += item.skipped;
      acc.failed += item.failed;
      return acc;
    }, { scanned: 0, posted: 0, skipped: 0, failed: 0 });

    return res.status(200).json({ success: true, message: "Journal backfill completed.", data: { totals, results } });
  } catch (error) {
    console.error("backfillJournalEntries error:", error);
    return res.status(500).json({ success: false, message: "Failed to backfill journal entries.", data: null });
  }
};
