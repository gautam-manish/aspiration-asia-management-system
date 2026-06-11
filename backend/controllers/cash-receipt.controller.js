import CashReceipt from "../models/cash-receipt.model.js";
import Counter from "../models/counter.model.js";
import Invoice from "../models/invoice.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import {
  syncCashReceiptCustomerPayment,
  voidLegacyCustomerPayments,
} from "../services/legacy-finance-integration.service.js";

// ─────────────────────────────────────────
// @desc    Create Cash Receipt
// @route   POST /api/cash-receipts
// ─────────────────────────────────────────
export const createCashReceipt = async (req, res) => {
  try {
    const invoiceNumber = String(req.body?.invoiceNumber || "").trim().toUpperCase();
    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required for cash receipts.", data: null });
    }
    const invoice = await Invoice.findOne({ invoiceNumber }).lean();
    if (!invoice) {
      return res.status(400).json({ success: false, message: "Cash receipts must be linked to an existing invoice.", data: null });
    }
    if (!String(invoice.bookingId || "").trim()) {
      return res.status(400).json({ success: false, message: "The linked invoice does not have a booking ID.", data: null });
    }

    // ✅ GET NEXT NUMBER
    const counter = await Counter.findOneAndUpdate(
      { name: "cashReceipt" },
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true }
    );

    // ✅ FORMAT TO 4 DIGIT
    const registrationNumber = String(counter.seq).padStart(4, "0");

    // ✅ CREATE WITH AUTO NUMBER
    const receipt = await CashReceipt.create({
      ...req.body,
      invoiceNumber: invoice.invoiceNumber,
      bookingId: invoice.bookingId,
      bankAccountId: req.body?.bankAccountId || null,
      registrationNumber
    });
    await syncCashReceiptCustomerPayment(receipt, req.user);

    res.status(201).json({ success: true, message: "Cash receipt created successfully", data: receipt });
  } catch (error) {
    console.error("createCashReceipt error:", error);
    res.status(400).json({ success: false, message: "Failed to create cash receipt.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Cash Receipts
//          - GET /api/cash-receipts?search=&date=                  → ALL (back-compat)
//          - GET /api/cash-receipts?search=&page=1&limit=50        → paginated envelope
// @route   GET /api/cash-receipts?search=name&date=
// ─────────────────────────────────────────
export const getAllCashReceipts = async (req, res) => {
  try {
    const { search, date, page, limit } = req.query;
    const query = {};

    if (search) query.name = { $regex: escapeRegex(search), $options: "i" };

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const receipts = await CashReceipt.find(query).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, message: "Cash receipts fetched successfully", data: receipts });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [receipts, total] = await Promise.all([
      CashReceipt.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      CashReceipt.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Cash receipts fetched successfully",
      data: receipts,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllCashReceipts error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch cash receipts.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Cash Receipt
// @route   GET /api/cash-receipts/:id
// ─────────────────────────────────────────
export const getCashReceiptById = async (req, res) => {
  try {
    const receipt = await CashReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: "Cash receipt not found", data: null });
    res.status(200).json({ success: true, message: "Cash receipt fetched successfully", data: receipt });
  } catch (error) {
    console.error("getCashReceiptById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch cash receipt.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Delete Cash Receipt
// @route   DELETE /api/cash-receipts/:id
// ─────────────────────────────────────────
export const deleteCashReceipt = async (req, res) => {
  try {
    const receipt = await CashReceipt.findByIdAndDelete(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: "Cash receipt not found", data: null });
    await voidLegacyCustomerPayments({
      source: "cash-receipt",
      sourceRefs: [receipt._id],
      notes: `Voided after Cash Receipt ${receipt.registrationNumber || ""} deletion`.trim(),
      user: req.user,
    });
    res.status(200).json({ success: true, message: "Cash receipt deleted successfully", data: null });
  } catch (error) {
    console.error("deleteCashReceipt error:", error);
    res.status(500).json({ success: false, message: "Failed to delete cash receipt.", data: null });
  }
};
