// Controller/purchaserecordController.js

import PurchaseRecord from "../models/purchase-record.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import {
  syncPurchaseRecordCredit,
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

    // ── Find Existing ───────────────────────
    let record = await PurchaseRecord.findOne({
      debtorName: debtorName.trim(),
    });

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
        openingBalance: Number(openingBalance || 0),
        fiscalYear,
        transactions: [],
      });
    }

    // ── Add Transaction ─────────────────────
    record.transactions.push({
      date: transaction.date || "",
      refNo: transaction.refNo || "",
      clientName: transaction.clientName || "",
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
      bank: transaction.bank || "",
      type: transaction.type || "cr",
      isOpening: false,
    });

    await record.save();
    const added = record.transactions?.[record.transactions.length - 1];
    if (added) await syncPurchaseRecordCredit(record, added, req.user);

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
      clientName: transaction.clientName || "",
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
      bank: transaction.bank || "",
      type: transaction.type || "cr",
      isOpening: false,
    });

    await record.save();
    const added = record.transactions?.[record.transactions.length - 1];
    if (added) await syncPurchaseRecordCredit(record, added, req.user);

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
