import VendorPayment from "../models/vendor-payment.model.js";
import VendorBill from "../models/vendor-bill.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import { recalcBillPaymentState } from "./vendor-bill.controller.js";
import { postVendorPaymentJournal, reverseJournalEntry } from "../services/journal.service.js";
import { resolveBookingId } from "../utils/bookingRef.js";

async function generatePaymentNumber() {
  const d = new Date();
  const prefix = `VP${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const count = await VendorPayment.countDocuments({ paymentNumber: { $regex: `^${prefix}` } });
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

async function findBill(body = {}) {
  if (body.vendorBillId) return VendorBill.findById(body.vendorBillId);
  if (body.billNumber) return VendorBill.findOne({ billNumber: String(body.billNumber).trim().toUpperCase() });
  return null;
}

function cleanPaymentPayload(body = {}, bill = null) {
  return {
    vendorBillId: bill?._id || body.vendorBillId || null,
    billNumber: String(bill?.billNumber || body.billNumber || "").trim().toUpperCase(),
    vendorId: body.vendorId || bill?.vendorId || null,
    bookingId: String(body.bookingId || bill?.bookingId || "").trim(),
    vendor: {
      name: String(body.vendor?.name || bill?.vendor?.name || "").trim(),
      company: String(body.vendor?.company || bill?.vendor?.company || "").trim(),
      email: String(body.vendor?.email || bill?.vendor?.email || "").trim().toLowerCase(),
      phone: String(body.vendor?.phone || bill?.vendor?.phone || "").trim(),
      address: String(body.vendor?.address || bill?.vendor?.address || "").trim(),
    },
    paymentDate: String(body.paymentDate || "").trim(),
    amount: round(body.amount),
    method: String(body.method || "bank").trim().toLowerCase(),
    referenceCode: String(body.referenceCode || "").trim(),
    bankAccountId: body.bankAccountId || null,
    slip: cleanSlip(body.slip),
    notes: String(body.notes || "").trim(),
  };
}

function validatePayment(data) {
  const errors = [];
  if (!data.paymentDate) errors.push("Payment date is required");
  if (!data.amount || data.amount <= 0) errors.push("Amount must be greater than zero");
  if (!data.vendor.name && !data.vendor.company) errors.push("Vendor is required");
  if (!data.vendorBillId && !data.bookingId) errors.push("Booking ID is required");
  if (!["cash", "bank", "card", "wallet", "cheque", "other"].includes(data.method)) errors.push("Invalid payment method");
  return errors;
}

async function validateVendorPaymentBusinessRules(data, excludeId = null) {
  const errors = [];
  const exclusion = excludeId ? { _id: { $ne: excludeId } } : {};

  if (data.referenceCode) {
    const referenceScope = [
      data.vendorBillId ? { vendorBillId: data.vendorBillId } : null,
      data.billNumber ? { billNumber: data.billNumber } : null,
      data.vendorId ? { vendorId: data.vendorId } : null,
    ].filter(Boolean);
    const duplicate = await VendorPayment.exists({
      ...exclusion,
      status: "posted",
      referenceCode: { $regex: `^${escapeRegex(data.referenceCode)}$`, $options: "i" },
      ...(referenceScope.length ? { $or: referenceScope } : {}),
    });
    if (duplicate) errors.push("A posted vendor payment with this reference already exists for the same bill/vendor.");
  }

  const bill = await findBill(data);
  if (bill) {
    const relatedPayments = await VendorPayment.find({
      ...exclusion,
      status: "posted",
      $or: [
        { vendorBillId: bill._id },
        { billNumber: String(bill.billNumber || "").toUpperCase() },
      ],
    }).select("amount").lean();
    const paidBefore = relatedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const outstanding = Math.round(((Number(bill.total) || 0) - paidBefore) * 100) / 100;
    if (data.amount > outstanding + 0.009) {
      errors.push(`Payment exceeds vendor bill outstanding balance (${outstanding.toFixed(2)}).`);
    }
  }

  return errors;
}

export const createVendorPayment = async (req, res) => {
  try {
    const amount = round(req.body.amount);
    if (!req.body.paymentDate) return res.status(400).json({ success: false, message: "Payment date is required.", data: null });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than zero.", data: null });

    const bill = await findBill(req.body);
    const data = cleanPaymentPayload(req.body, bill);
    const bookingRef = await resolveBookingId(data.bookingId);
    if (bookingRef.error) return res.status(400).json({ success: false, message: bookingRef.error, data: null });
    data.bookingId = bookingRef.bookingId;
    const errors = [
      ...validatePayment(data),
      ...(await validateVendorPaymentBusinessRules(data)),
    ];
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". "), data: null });

    const payment = await VendorPayment.create({
      paymentNumber: await generatePaymentNumber(),
      ...data,
    });

    if (bill) await recalcBillPaymentState(bill._id);
    await postVendorPaymentJournal(payment, req.user);
    return res.status(201).json({ success: true, message: "Vendor payment recorded.", data: payment });
  } catch (error) {
    console.error("createVendorPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to record vendor payment.", data: null });
  }
};

export const getAllVendorPayments = async (req, res) => {
  try {
    const { search, vendorId, vendorBillId, billNumber, bookingId, status = "posted", from, to, page, limit } = req.query;
    const filter = {};
    if (status && ["posted", "void"].includes(status)) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;
    if (vendorBillId) filter.vendorBillId = vendorBillId;
    if (billNumber) filter.billNumber = String(billNumber).trim().toUpperCase();
    if (bookingId) filter.bookingId = String(bookingId).trim();
    if (from || to) {
      filter.paymentDate = {};
      if (from) filter.paymentDate.$gte = String(from);
      if (to) filter.paymentDate.$lte = String(to);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { paymentNumber: { $regex: escaped, $options: "i" } },
        { billNumber: { $regex: escaped, $options: "i" } },
        { bookingId: { $regex: escaped, $options: "i" } },
        { "vendor.name": { $regex: escaped, $options: "i" } },
        { "vendor.company": { $regex: escaped, $options: "i" } },
        { referenceCode: { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;
    if (!wantsPagination) {
      const payments = await VendorPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 });
      return res.status(200).json({ success: true, data: payments });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const [payments, total] = await Promise.all([
      VendorPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      VendorPayment.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: payments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllVendorPayments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendor payments.", data: null });
  }
};

export const getVendorPaymentById = async (req, res) => {
  try {
    const payment = await VendorPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Vendor payment not found.", data: null });
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error("getVendorPaymentById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendor payment.", data: null });
  }
};

export const updateVendorPayment = async (req, res) => {
  try {
    const existing = await VendorPayment.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Vendor payment not found.", data: null });
    if (existing.status === "void") {
      return res.status(400).json({ success: false, message: "Voided payments cannot be edited.", data: null });
    }

    const previousBillId = existing.vendorBillId ? String(existing.vendorBillId) : "";
    const merged = { ...existing.toObject(), ...req.body };
    const bill = await findBill(merged);
    const data = cleanPaymentPayload(merged, bill);
    const bookingRef = await resolveBookingId(data.bookingId);
    if (bookingRef.error) return res.status(400).json({ success: false, message: bookingRef.error, data: null });
    data.bookingId = bookingRef.bookingId;
    const errors = [
      ...validatePayment(data),
      ...(await validateVendorPaymentBusinessRules(data, req.params.id)),
    ];
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(". "), data: null });

    Object.assign(existing, data);
    await existing.save();

    const nextBillId = existing.vendorBillId ? String(existing.vendorBillId) : "";
    if (previousBillId) await recalcBillPaymentState(previousBillId);
    if (nextBillId && nextBillId !== previousBillId) await recalcBillPaymentState(nextBillId);
    await postVendorPaymentJournal(existing, req.user);

    return res.status(200).json({ success: true, message: "Vendor payment updated.", data: existing });
  } catch (error) {
    console.error("updateVendorPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to update vendor payment.", data: null });
  }
};

export const voidVendorPayment = async (req, res) => {
  try {
    const payment = await VendorPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: "Vendor payment not found.", data: null });
    payment.status = "void";
    payment.notes = req.body?.notes || payment.notes || "";
    await payment.save();
    if (payment.vendorBillId) await recalcBillPaymentState(payment.vendorBillId);
    await reverseJournalEntry({
      sourceEntity: "vendor-payment",
      sourceId: payment._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Vendor payment ${payment.paymentNumber || ""} voided`.trim(),
      user: req.user,
    });
    return res.status(200).json({ success: true, message: "Vendor payment voided.", data: payment });
  } catch (error) {
    console.error("voidVendorPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to void vendor payment.", data: null });
  }
};
