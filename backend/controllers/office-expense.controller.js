import OfficeExpense from "../models/office-expense.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import { postOfficeExpenseJournal, reverseJournalEntry } from "../services/journal.service.js";

async function generateExpenseNumber() {
  const d = new Date();
  const prefix = `OE${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await OfficeExpense.countDocuments({ expenseNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

function cleanSlip(slip = {}) {
  return slip && slip.url
    ? {
        url: String(slip.url || "").trim(),
        fileName: String(slip.fileName || "").trim(),
        mimeType: String(slip.mimeType || "").trim(),
        size: Number(slip.size) || 0,
      }
    : { url: "", fileName: "", mimeType: "", size: 0 };
}

function cleanPayload(body = {}) {
  return {
    expenseDate: String(body.expenseDate || body.date || "").trim(),
    category: String(body.category || "other").trim(),
    paidTo: String(body.paidTo || "").trim(),
    description: String(body.description || "").trim(),
    amount: round(body.amount),
    paymentMethod: String(body.paymentMethod || "cash").trim().toLowerCase(),
    referenceCode: String(body.referenceCode || "").trim(),
    bankAccountId: body.bankAccountId || null,
    slip: cleanSlip(body.slip),
    notes: String(body.notes || "").trim(),
  };
}

export const createOfficeExpense = async (req, res) => {
  try {
    const data = cleanPayload(req.body);
    if (!data.expenseDate) return res.status(400).json({ success: false, message: "Expense date is required.", data: null });
    if (!data.description) return res.status(400).json({ success: false, message: "Description is required.", data: null });
    if (!data.amount || data.amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than zero.", data: null });

    const expense = await OfficeExpense.create({
      ...data,
      expenseNumber: await generateExpenseNumber(),
    });
    await postOfficeExpenseJournal(expense, req.user);
    return res.status(201).json({ success: true, message: "Office expense recorded.", data: expense });
  } catch (error) {
    console.error("createOfficeExpense error:", error);
    return res.status(400).json({ success: false, message: "Failed to record office expense.", data: null });
  }
};

export const getAllOfficeExpenses = async (req, res) => {
  try {
    const { search, category, status = "posted", from, to, page, limit } = req.query;
    const filter = {};
    if (status && ["posted", "void"].includes(status)) filter.status = status;
    if (category) filter.category = String(category);
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = String(from);
      if (to) filter.expenseDate.$lte = String(to);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { expenseNumber: { $regex: escaped, $options: "i" } },
        { paidTo: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { referenceCode: { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;
    if (!wantsPagination) {
      const expenses = await OfficeExpense.find(filter).sort({ expenseDate: -1, createdAt: -1 });
      return res.status(200).json({ success: true, data: expenses });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const [expenses, total] = await Promise.all([
      OfficeExpense.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      OfficeExpense.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: expenses,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllOfficeExpenses error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch office expenses.", data: null });
  }
};

export const getOfficeExpenseById = async (req, res) => {
  try {
    const expense = await OfficeExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: "Office expense not found.", data: null });
    return res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error("getOfficeExpenseById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch office expense.", data: null });
  }
};

export const updateOfficeExpense = async (req, res) => {
  try {
    const existing = await OfficeExpense.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Office expense not found.", data: null });
    if (existing.status === "void") {
      return res.status(400).json({ success: false, message: "Voided office expenses cannot be edited.", data: null });
    }

    const data = cleanPayload({ ...existing.toObject(), ...req.body });
    if (!data.expenseDate) return res.status(400).json({ success: false, message: "Expense date is required.", data: null });
    if (!data.description) return res.status(400).json({ success: false, message: "Description is required.", data: null });
    if (!data.amount || data.amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than zero.", data: null });

    const expense = await OfficeExpense.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    );
    await postOfficeExpenseJournal(expense, req.user);
    return res.status(200).json({ success: true, message: "Office expense updated.", data: expense });
  } catch (error) {
    console.error("updateOfficeExpense error:", error);
    return res.status(400).json({ success: false, message: "Failed to update office expense.", data: null });
  }
};

export const voidOfficeExpense = async (req, res) => {
  try {
    const expense = await OfficeExpense.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "void", notes: req.body?.notes || "" } },
      { returnDocument: "after", runValidators: true },
    );
    if (!expense) return res.status(404).json({ success: false, message: "Office expense not found.", data: null });
    await reverseJournalEntry({
      sourceEntity: "office-expense",
      sourceId: expense._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Office expense ${expense.expenseNumber || ""} voided`.trim(),
      user: req.user,
    });
    return res.status(200).json({ success: true, message: "Office expense voided.", data: expense });
  } catch (error) {
    console.error("voidOfficeExpense error:", error);
    return res.status(400).json({ success: false, message: "Failed to void office expense.", data: null });
  }
};
