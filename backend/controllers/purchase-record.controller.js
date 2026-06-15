// Controller/purchaserecordController.js

import PurchaseRecord from "../models/purchase-record.model.js";
import BankAccount from "../models/bank-account.model.js";
import CustomerPayment from "../models/customer-payment.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import OfficeExpense from "../models/office-expense.model.js";
import Sundry from "../models/sundry.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import { resolveBookingId } from "../utils/bookingRef.js";
import {
  voidPurchaseRecordCustomerPayments,
} from "../services/legacy-finance-integration.service.js";

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────
const fmt = (n = 0) =>
  Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const calcClosing = (opening = 0, dr = 0, cr = 0) =>
  Number(opening || 0) + Number(dr || 0) - Number(cr || 0);

function cleanAttachment(attachment = {}) {
  return attachment && attachment.url
    ? {
        url: String(attachment.url || "").trim(),
        fileName: String(attachment.fileName || "").trim(),
        mimeType: String(attachment.mimeType || "").trim(),
        size: Number(attachment.size) || 0,
      }
    : { url: "", fileName: "", mimeType: "", size: 0 };
}

function cleanLineItems(lineItems = []) {
  return Array.isArray(lineItems)
    ? lineItems.map((line) => ({
        serviceType: String(line.serviceType || "other").trim(),
        description: String(line.description || "").trim(),
        qty: Number(line.qty) || 0,
        rate: Number(line.rate) || 0,
        amount: Number(line.amount) || 0,
      })).filter((line) => line.description || line.amount > 0)
    : [];
}

async function getBankAvailableBalance(bankName) {
  const cleanName = String(bankName || "").trim();
  if (!cleanName) return null;

  const bank = await BankAccount.findOne({ bankName: cleanName }).lean();
  if (!bank) return null;

  const [purchaseDebitAgg, customerPaymentAgg, vendorPaymentAgg, officeExpenseAgg] = await Promise.all([
    PurchaseRecord.aggregate([
      { $unwind: "$transactions" },
      { $match: { "transactions.type": "dr", "transactions.bank": cleanName } },
      { $group: { _id: null, total: { $sum: "$transactions.amount" } } },
    ]),
    CustomerPayment.aggregate([
      { $match: { status: "posted", bankAccountId: bank._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    VendorPayment.aggregate([
      { $match: { status: "posted", bankAccountId: bank._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    OfficeExpense.aggregate([
      { $match: { status: "posted", bankAccountId: bank._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const manualCredit = (bank.transactions || [])
    .filter((t) => t.type === "cr")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const manualDebit = (bank.transactions || [])
    .filter((t) => t.type === "dr")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const purchaseDebit = Number(purchaseDebitAgg[0]?.total || 0);
  const customerPaymentCredit = Number(customerPaymentAgg[0]?.total || 0);
  const vendorPaymentDebit = Number(vendorPaymentAgg[0]?.total || 0);
  const officeExpenseDebit = Number(officeExpenseAgg[0]?.total || 0);

  return Number(bank.openingBalance || 0)
    + manualCredit
    + customerPaymentCredit
    - purchaseDebit
    - manualDebit
    - vendorPaymentDebit
    - officeExpenseDebit;
}

async function validatePurchaseTransactionBank(transaction) {
  if (transaction.type !== "dr") {
    transaction.bank = "";
    return null;
  }

  if (!String(transaction.bank || "").trim()) {
    return "Bank account is required for debit entries.";
  }

  const balance = await getBankAvailableBalance(transaction.bank);
  if (balance == null) {
    return "Selected bank account was not found.";
  }

  const amount = Number(transaction.amount || 0);
  if (amount > balance) {
    return `Amount exceeds selected bank balance. Available balance is Rs. ${fmt(balance)}.`;
  }

  return null;
}

async function validatePurchaseTransactionBooking(transaction) {
  const bookingRef = await resolveBookingId(transaction.bookingId);
  if (bookingRef.error) return bookingRef;
  transaction.bookingId = bookingRef.bookingId;
  return bookingRef;
}

// ─────────────────────────────────────────────
// GET ALL PURCHASE RECORDS
//   - GET /api/purchaserecords?search=abc                       → ALL (back-compat)
//   - GET /api/purchaserecords?search=&page=1&limit=50          → paginated envelope
// ─────────────────────────────────────────────
export const getAllPurchaseRecords = async (req, res) => {
  try {
    const { search = "", page, limit } = req.query;

    const filter = search
      ? {
          debtorName: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        }
      : {};

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const records = await PurchaseRecord.find(filter).sort({ debtorName: 1 });
      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      PurchaseRecord.find(filter).sort({ debtorName: 1 }).skip(skip).limit(limitNum),
      PurchaseRecord.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllPurchaseRecords error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase records.",
    });
  }
};

// ─────────────────────────────────────────────
// GET RECORD BY DEBTOR NAME (case-insensitive exact match)
// GET /api/purchaserecords/by-debtor/:debtorName
// Used by the frontend to detect whether an account already exists
// before submitting a new purchase entry.
// ─────────────────────────────────────────────
export const getPurchaseRecordByDebtor = async (req, res) => {
  try {
    const debtorName = decodeURIComponent(req.params.debtorName || "").trim();
    if (!debtorName) {
      return res.status(400).json({ success: false, message: "Debtor name is required." });
    }
    const record = await PurchaseRecord.findOne({
      debtorName: { $regex: `^${debtorName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, $options: "i" },
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "No purchase record for this debtor." });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error("getPurchaseRecordByDebtor error:", error);
    return res.status(500).json({ success: false, message: "Failed to look up record." });
  }
};

// ─────────────────────────────────────────────
// GET SINGLE RECORD
// GET /api/purchaserecords/:id
// ─────────────────────────────────────────────
export const getPurchaseRecordById = async (req, res) => {
  try {
    const record = await PurchaseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("getPurchaseRecordById error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch record.",
    });
  }
};

// ─────────────────────────────────────────────
// CREATE OR ADD ENTRY
// POST /api/purchaserecords
// ─────────────────────────────────────────────
export const createOrAddToPurchaseRecord = async (req, res) => {
  try {
    const {
      vendorId = "",
      debtorName,
      debtorCompany = "",
      debtorPan = "",
      debtorAddress = "",
      debtorPhone = "",
      debtorEmail = "",
      openingBalance = 0,
      fiscalYear = "",
      transaction,
    } = req.body;
    const cleanVendorId = String(vendorId || "").trim() || null;

    // ── Validation ──────────────────────────
    if (!debtorName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Debtor name is required.",
      });
    }

    if (!transaction) {
      return res.status(400).json({
        success: false,
        message: "Transaction data is required.",
      });
    }

    if (!transaction.date) {
      return res.status(400).json({
        success: false,
        message: "Transaction date is required.",
      });
    }

    if (!transaction.amount || Number(transaction.amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Transaction amount must be greater than zero.",
      });
    }

    const bankError = await validatePurchaseTransactionBank(transaction);
    if (bankError) {
      return res.status(400).json({
        success: false,
        message: bankError,
      });
    }
    const bookingRef = await validatePurchaseTransactionBooking(transaction);
    if (bookingRef.error) {
      return res.status(400).json({
        success: false,
        message: bookingRef.error,
      });
    }

    // ── Find Existing ───────────────────────
    let record = cleanVendorId
      ? await PurchaseRecord.findOne({ vendorId: cleanVendorId })
      : null;
    if (!record) {
      record = await PurchaseRecord.findOne({
        debtorName: debtorName.trim(),
      });
    }
    if (cleanVendorId) {
      const vendor = await Sundry.findById(cleanVendorId).lean();
      if (!vendor || !((vendor.roles || []).includes("vendor") || vendor.type === "creditor")) {
        return res.status(400).json({
          success: false,
          message: "Selected vendor was not found.",
        });
      }
    }

    // ────────────────────────────────────────
    // CREATE NEW RECORD
    // ────────────────────────────────────────
    if (!record) {
      record = new PurchaseRecord({
        debtorName: debtorName.trim(),
        debtorCompany,
        debtorPan,
        debtorAddress,
        debtorPhone,
        debtorEmail,
        vendorId: cleanVendorId,
        openingBalance: Number(openingBalance || 0),
        fiscalYear,
        transactions: [],
      });
    } else if (cleanVendorId && !record.vendorId) {
      record.vendorId = cleanVendorId;
    }

    // ── Add Transaction ─────────────────────
    record.transactions.push({
      date: transaction.date || "",
      refNo: transaction.refNo || "",
      bookingId: transaction.bookingId || "",
      clientName: transaction.clientName || "",
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
      bank: transaction.bank || "",
      type: transaction.type || "cr",
      isOpening: false,
      attachment: cleanAttachment(transaction.attachment),
      lineItems: cleanLineItems(transaction.lineItems),
      taxAmount: Number(transaction.taxAmount) || 0,
    });

    await record.save();

    return res.status(201).json({
      success: true,
      message: "Purchase entry saved successfully.",
      data: record,
    });
  } catch (error) {
    console.error("createOrAddToPurchaseRecord error:", error);

    // Duplicate debtor unique error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Debtor already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save purchase record.",
    });
  }
};

// ─────────────────────────────────────────────
// ADD TRANSACTION
// POST /api/purchaserecords/:id/transaction
// ─────────────────────────────────────────────
export const addTransaction = async (req, res) => {
  try {
    const { transaction } = req.body;

    if (!transaction) {
      return res.status(400).json({
        success: false,
        message: "Transaction data is required.",
      });
    }

    if (!transaction.date) {
      return res.status(400).json({
        success: false,
        message: "Transaction date is required.",
      });
    }

    if (!transaction.amount || Number(transaction.amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Transaction amount must be greater than zero.",
      });
    }

    const bankError = await validatePurchaseTransactionBank(transaction);
    if (bankError) {
      return res.status(400).json({
        success: false,
        message: bankError,
      });
    }
    const bookingRef = await validatePurchaseTransactionBooking(transaction);
    if (bookingRef.error) {
      return res.status(400).json({
        success: false,
        message: bookingRef.error,
      });
    }

    const record = await PurchaseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
    }

    record.transactions.push({
      date: transaction.date || "",
      refNo: transaction.refNo || "",
      bookingId: transaction.bookingId || "",
      clientName: transaction.clientName || "",
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
      bank: transaction.bank || "",
      type: transaction.type || "cr",
      isOpening: false,
      attachment: cleanAttachment(transaction.attachment),
      lineItems: cleanLineItems(transaction.lineItems),
      taxAmount: Number(transaction.taxAmount) || 0,
    });

    await record.save();

    return res.status(200).json({
      success: true,
      message: "Transaction added successfully.",
      data: record,
    });
  } catch (error) {
    console.error("addTransaction error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add transaction.",
    });
  }
};

// ─────────────────────────────────────────────
// UPDATE PURCHASE RECORD INFO
// PUT /api/purchaserecords/:id
// ─────────────────────────────────────────────
export const updatePurchaseRecord = async (req, res) => {
  try {
    const allowedFields = [
      "debtorCompany",
      "debtorPan",
      "debtorAddress",
      "debtorPhone",
      "debtorEmail",
      "fiscalYear",
      "openingBalance",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const record = await PurchaseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
    }

    Object.assign(record, updateData);

    // recalculate manually
    record.closingBalance = calcClosing(
      record.openingBalance,
      record.totalDebit,
      record.totalCredit
    );

    await record.save();

    return res.status(200).json({
      success: true,
      message: "Purchase record updated successfully.",
      data: record,
    });
  } catch (error) {
    console.error("updatePurchaseRecord error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update purchase record.",
    });
  }
};

// ─────────────────────────────────────────────
// DELETE PURCHASE RECORD
// DELETE /api/purchaserecords/:id
// ─────────────────────────────────────────────
export const updateTransactionAttachment = async (req, res) => {
  try {
    const { attachment, taxAmount } = req.body;
    const record = await PurchaseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
    }

    const transaction = record.transactions.id(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Purchase entry not found.",
      });
    }

    if (attachment !== undefined) transaction.attachment = cleanAttachment(attachment);
    if (taxAmount !== undefined) transaction.taxAmount = Number(taxAmount) || 0;
    await record.save();

    return res.status(200).json({
      success: true,
      message: "Tax invoice slip updated successfully.",
      data: record,
    });
  } catch (error) {
    console.error("updateTransactionAttachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update tax invoice slip.",
    });
  }
};

export const deletePurchaseRecord = async (req, res) => {
  try {
    const record = await PurchaseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
    }

    await record.deleteOne();
    await voidPurchaseRecordCustomerPayments(record._id, req.user);

    return res.status(200).json({
      success: true,
      message: "Purchase record deleted successfully.",
    });
  } catch (error) {
    console.error("deletePurchaseRecord error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete purchase record.",
    });
  }
};

// ─────────────────────────────────────────────
// GENERATE LEDGER PDF (legacy server route)
// PDF export is handled client-side via html2pdf on purchaserecord-detail.html
// ─────────────────────────────────────────────
export const generateLedgerPdf = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "Use Generate PDF Report on the detail page (browser export).",
  });
};

export const uploadPurchaseRecordAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded.", data: null });
    }

    const url = `/uploads/purchase-record-attachments/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      message: "Purchase record attachment uploaded successfully",
      data: {
        url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("uploadPurchaseRecordAttachment error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload attachment.", data: null });
  }
};
