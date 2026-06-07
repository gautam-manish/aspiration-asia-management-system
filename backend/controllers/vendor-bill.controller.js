import VendorBill from "../models/vendor-bill.model.js";
import VendorPayment from "../models/vendor-payment.model.js";
import Sundry from "../models/sundry.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import { postVendorBillJournal, reverseJournalEntry } from "../services/journal.service.js";

async function generateBillNumber() {
  const d = new Date();
  const prefix = `VB${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await VendorBill.countDocuments({ billNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toDateOnly = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const daysBetween = (from, to) => {
  const a = new Date(`${from}T00:00:00.000Z`);
  const b = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
};

function attachAgingSummary(billsInput) {
  const isArray = Array.isArray(billsInput);
  const bills = isArray ? billsInput : [billsInput].filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const enriched = bills.map((bill) => {
    const obj = typeof bill.toObject === "function" ? bill.toObject() : { ...bill };
    const dueDate = toDateOnly(obj.dueDate) || toDateOnly(obj.billDate);
    const balance = round(obj.balance);
    const overdueDays = obj.status !== "void" && balance > 0 && dueDate && dueDate < today ? daysBetween(dueDate, today) : 0;
    const displayStatus = obj.status === "void"
      ? "void"
      : balance <= 0
        ? "paid"
        : overdueDays > 0
          ? "overdue"
          : obj.status || "open";

    return {
      ...obj,
      dueDate,
      paymentSummary: {
        total: round(obj.total),
        paid: round(obj.amountPaid),
        balance,
        overdueDays,
        status: displayStatus,
      },
    };
  });
  return isArray ? enriched : enriched[0];
}

function cleanLines(lines = []) {
  return lines
    .map((line) => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const amount = round(line.amount !== undefined && line.amount !== "" ? line.amount : qty * rate);
      return {
        serviceType: line.serviceType || "other",
        description: String(line.description || "").trim(),
        qty,
        rate,
        amount,
      };
    })
    .filter((line) => line.description && line.amount >= 0);
}

async function vendorSnapshot(body) {
  let vendor = {
    name: String(body.vendor?.name || body.vendorName || "").trim(),
    company: String(body.vendor?.company || "").trim(),
    email: String(body.vendor?.email || "").trim().toLowerCase(),
    phone: String(body.vendor?.phone || "").trim(),
    address: String(body.vendor?.address || "").trim(),
    pan: String(body.vendor?.pan || "").trim(),
  };

  if (body.vendorId) {
    const sundry = await Sundry.findById(body.vendorId).lean();
    if (sundry) {
      vendor = {
        name: vendor.name || sundry.contactPerson || "",
        company: vendor.company || sundry.companyName || "",
        email: vendor.email || sundry.email || "",
        phone: vendor.phone || sundry.phone || "",
        address: vendor.address || sundry.address || "",
        pan: vendor.pan || sundry.panVatGst || "",
      };
    }
  }
  return vendor;
}

async function recalcBillPaymentState(billId) {
  const bill = await VendorBill.findById(billId);
  if (!bill) return null;

  const payments = await VendorPayment.find({ vendorBillId: bill._id, status: "posted" }).select("amount").lean();
  const amountPaid = round(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  const balance = round(Math.max(0, (Number(bill.total) || 0) - amountPaid));
  bill.amountPaid = amountPaid;
  bill.balance = balance;
  bill.status = bill.status === "void" ? "void" : balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "open";
  await bill.save();
  return bill;
}

export { recalcBillPaymentState };

export const createVendorBill = async (req, res) => {
  try {
    const lines = cleanLines(req.body.lines || []);
    if (!req.body.billDate) return res.status(400).json({ success: false, message: "Bill date is required.", data: null });
    if (!lines.length) return res.status(400).json({ success: false, message: "At least one bill line is required.", data: null });

    const subtotal = round(req.body.subtotal ?? lines.reduce((sum, line) => sum + line.amount, 0));
    const taxAmount = round(req.body.taxAmount || 0);
    const total = round(req.body.total ?? subtotal + taxAmount);
    const amountPaid = round(req.body.amountPaid || 0);
    const balance = round(Math.max(0, total - amountPaid));

    const bill = await VendorBill.create({
      billNumber: req.body.billNumber || await generateBillNumber(),
      vendorInvoiceNumber: String(req.body.vendorInvoiceNumber || "").trim(),
      billDate: String(req.body.billDate || "").trim(),
      dueDate: String(req.body.dueDate || "").trim(),
      bookingId: String(req.body.bookingId || "").trim(),
      vendorId: req.body.vendorId || null,
      vendor: await vendorSnapshot(req.body),
      lines,
      subtotal,
      taxAmount,
      total,
      amountPaid,
      balance,
      currency: String(req.body.currency || "Rs.").trim(),
      status: balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "open",
      notes: String(req.body.notes || "").trim(),
    });
    await postVendorBillJournal(bill, req.user);

    return res.status(201).json({ success: true, message: "Vendor bill created.", data: attachAgingSummary(bill) });
  } catch (error) {
    console.error("createVendorBill error:", error);
    return res.status(400).json({ success: false, message: "Failed to create vendor bill.", data: null });
  }
};

export const getAllVendorBills = async (req, res) => {
  try {
    const { search, vendorId, bookingId, status, from, to, page, limit } = req.query;
    const filter = {};
    if (vendorId) filter.vendorId = vendorId;
    if (bookingId) filter.bookingId = String(bookingId).trim();
    if (status && ["open", "partial", "paid", "void"].includes(status)) filter.status = status;
    if (from || to) {
      filter.billDate = {};
      if (from) filter.billDate.$gte = String(from);
      if (to) filter.billDate.$lte = String(to);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { billNumber: { $regex: escaped, $options: "i" } },
        { vendorInvoiceNumber: { $regex: escaped, $options: "i" } },
        { bookingId: { $regex: escaped, $options: "i" } },
        { "vendor.name": { $regex: escaped, $options: "i" } },
        { "vendor.company": { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;
    if (!wantsPagination) {
      const bills = await VendorBill.find(filter).sort({ billDate: -1, createdAt: -1 });
      return res.status(200).json({ success: true, data: attachAgingSummary(bills) });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const [bills, total] = await Promise.all([
      VendorBill.find(filter).sort({ billDate: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      VendorBill.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: attachAgingSummary(bills),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllVendorBills error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendor bills.", data: null });
  }
};

export const getVendorBillById = async (req, res) => {
  try {
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Vendor bill not found.", data: null });
    const payments = await VendorPayment.find({ vendorBillId: bill._id }).sort({ paymentDate: -1, createdAt: -1 });
    return res.status(200).json({ success: true, data: { bill: attachAgingSummary(bill), payments } });
  } catch (error) {
    console.error("getVendorBillById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendor bill.", data: null });
  }
};

export const updateVendorBill = async (req, res) => {
  try {
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: "Vendor bill not found.", data: null });
    if (bill.status === "void") {
      return res.status(400).json({ success: false, message: "Voided vendor bills cannot be edited.", data: null });
    }

    const lines = cleanLines(req.body.lines || bill.lines || []);
    if (!req.body.billDate && !bill.billDate) return res.status(400).json({ success: false, message: "Bill date is required.", data: null });
    if (!lines.length) return res.status(400).json({ success: false, message: "At least one bill line is required.", data: null });

    const subtotal = round(req.body.subtotal ?? lines.reduce((sum, line) => sum + line.amount, 0));
    const taxAmount = round(req.body.taxAmount ?? bill.taxAmount ?? 0);
    const total = round(req.body.total ?? subtotal + taxAmount);

    bill.vendorInvoiceNumber = String(req.body.vendorInvoiceNumber ?? bill.vendorInvoiceNumber ?? "").trim();
    bill.billDate = String(req.body.billDate ?? bill.billDate ?? "").trim();
    bill.dueDate = String(req.body.dueDate ?? bill.dueDate ?? "").trim();
    bill.bookingId = String(req.body.bookingId ?? bill.bookingId ?? "").trim();
    bill.vendorId = req.body.vendorId ?? bill.vendorId ?? null;
    bill.vendor = await vendorSnapshot({ ...bill.toObject(), ...req.body });
    bill.lines = lines;
    bill.subtotal = subtotal;
    bill.taxAmount = taxAmount;
    bill.total = total;
    bill.currency = String(req.body.currency ?? bill.currency ?? "Rs.").trim();
    bill.notes = String(req.body.notes ?? bill.notes ?? "").trim();
    await bill.save();

    const recalculated = await recalcBillPaymentState(bill._id);
    await postVendorBillJournal(recalculated, req.user);
    return res.status(200).json({ success: true, message: "Vendor bill updated.", data: attachAgingSummary(recalculated) });
  } catch (error) {
    console.error("updateVendorBill error:", error);
    return res.status(400).json({ success: false, message: "Failed to update vendor bill.", data: null });
  }
};

export const voidVendorBill = async (req, res) => {
  try {
    const postedPayment = await VendorPayment.exists({ vendorBillId: req.params.id, status: "posted" });
    if (postedPayment) {
      return res.status(400).json({ success: false, message: "Void posted payments before voiding this bill.", data: null });
    }
    const bill = await VendorBill.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "void", balance: 0, amountPaid: 0, notes: req.body?.notes || "" } },
      { returnDocument: "after", runValidators: true },
    );
    if (!bill) return res.status(404).json({ success: false, message: "Vendor bill not found.", data: null });
    await reverseJournalEntry({
      sourceEntity: "vendor-bill",
      sourceId: bill._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Vendor bill ${bill.billNumber || ""} voided`.trim(),
      user: req.user,
    });
    return res.status(200).json({ success: true, message: "Vendor bill voided.", data: attachAgingSummary(bill) });
  } catch (error) {
    console.error("voidVendorBill error:", error);
    return res.status(400).json({ success: false, message: "Failed to void vendor bill.", data: null });
  }
};
