import CashReceipt from "../models/cash-receipt.model.js";
import Counter from "../models/counter.model.js"; // ✅ ADD THIS

// ─────────────────────────────────────────
// @desc    Create Cash Receipt
// @route   POST /api/cash-receipts
// ─────────────────────────────────────────
export const createCashReceipt = async (req, res) => {
  try {
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
      registrationNumber
    });

    res.status(201).json({ success: true, message: "Cash receipt created successfully", data: receipt });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Cash Receipts
// @route   GET /api/cash-receipts?search=name&date=
// ─────────────────────────────────────────
export const getAllCashReceipts = async (req, res) => {
  try {
    const { search, date } = req.query;
    const query = {};

    if (search) query.name = { $regex: search, $options: "i" };

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const receipts = await CashReceipt.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "Cash receipts fetched successfully", data: receipts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(200).json({ success: true, message: "Cash receipt deleted successfully", data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};