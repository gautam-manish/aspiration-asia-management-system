import CustomerPayment from "../models/customer-payment.model.js";
import Invoice from "../models/invoice.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import { postCustomerPaymentJournal, reverseJournalEntry } from "../services/journal.service.js";
import { resolveBookingId } from "../utils/bookingRef.js";

async function generatePaymentNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `CP${y}${m}`;
  const count = await CustomerPayment.countDocuments({
    paymentNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function cleanSlip(slip = {}) {
  return slip && slip.url
    ? {
        url:      String(slip.url || "").trim(),
        fileName: String(slip.fileName || "").trim(),
        mimeType: String(slip.mimeType || "").trim(),
        size:     Number(slip.size) || 0,
      }
    : { url: "", fileName: "", mimeType: "", size: 0 };
}

function cleanPayload(body = {}) {
  const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
  return {
    customerId: body.customerId || null,
    invoiceId: body.invoiceId || null,
    invoiceNumber: String(body.invoiceNumber || "").trim().toUpperCase(),
    bookingId: String(body.bookingId || "").trim(),
    customer: {
      name: String(body.customer?.name || body.customerName || "").trim(),
      email: String(body.customer?.email || body.customerEmail || "").trim().toLowerCase(),
      phone: String(body.customer?.phone || body.customerPhone || "").trim(),
      address: String(body.customer?.address || body.customerAddress || "").trim(),
    },
    paymentDate: String(body.paymentDate || body.date || "").trim(),
    amount,
    method: String(body.method || "bank").trim().toLowerCase(),
    referenceCode: String(body.referenceCode || "").trim(),
    bankAccountId: body.bankAccountId || null,
    slip: cleanSlip(body.slip),
    source: String(body.source || "manual").trim(),
    sourceRef: String(body.sourceRef || "").trim(),
    notes: String(body.notes || "").trim(),
  };
}

function validatePaymentPayload(data) {
  const errors = [];
  if (!data.paymentDate) errors.push("Payment date is required");
  if (!Number.isFinite(data.amount) || data.amount <= 0) errors.push("Amount must be greater than zero");
  if (!["cash", "bank", "card", "wallet", "cheque", "other"].includes(data.method)) {
    errors.push("Invalid payment method");
  }
  if (!["manual", "invoice-advance", "sales-record", "cash-receipt", "purchase-record"].includes(data.source)) {
    errors.push("Invalid payment source");
  }
  return errors;
}

async function validateCustomerPaymentBusinessRules(data, excludeId = null) {
  const errors = [];
  const exclusion = excludeId ? { _id: { $ne: excludeId } } : {};
  if (!String(data.bookingId || "").trim()) {
    errors.push("Booking ID is required");
  }

  if (data.referenceCode) {
    const referenceScope = [
      data.invoiceId ? { invoiceId: data.invoiceId } : null,
      data.invoiceNumber ? { invoiceNumber: data.invoiceNumber } : null,
      data.customerId ? { customerId: data.customerId } : null,
    ].filter(Boolean);
    const duplicate = await CustomerPayment.exists({
      ...exclusion,
      status: "posted",
      referenceCode: { $regex: `^${escapeRegex(data.referenceCode)}$`, $options: "i" },
      ...(referenceScope.length ? { $or: referenceScope } : {}),
    });
    if (duplicate) errors.push("A posted customer payment with this reference already exists for the same invoice/customer.");
  }

  let invoice = null;
  if (data.invoiceId) invoice = await Invoice.findById(data.invoiceId).lean();
  if (!invoice && data.invoiceNumber) {
    invoice = await Invoice.findOne({ invoiceNumber: data.invoiceNumber }).lean();
  }
  if (invoice) {
    const relatedPayments = await CustomerPayment.find({
      ...exclusion,
      status: "posted",
      $or: [
        { invoiceId: invoice._id },
        { invoiceNumber: String(invoice.invoiceNumber || "").toUpperCase() },
      ],
    }).select("amount").lean();
    const paidBefore = relatedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const outstanding = Math.round(((Number(invoice.total) || 0) - paidBefore) * 100) / 100;
    if (data.amount > outstanding + 0.009) {
      errors.push(`Payment exceeds invoice outstanding balance (${outstanding.toFixed(2)}).`);
    }
  }

  return errors;
}

export async function createCustomerPaymentFromInvoiceAdvance(invoice, advanceEntry) {
  if (!invoice || !advanceEntry) return null;

  const sourceRef = String(advanceEntry._id || "");
  if (sourceRef) {
    const existing = await CustomerPayment.findOne({ source: "invoice-advance", sourceRef });
    if (existing) return existing;
  }

  const payload = cleanPayload({
    customerId: invoice.customerId || null,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    bookingId: invoice.bookingId,
    customer: {
      name: invoice.billTo?.name || "",
      email: invoice.billTo?.email || "",
      phone: invoice.billTo?.mobile || "",
      address: invoice.billTo?.address || "",
    },
    paymentDate: advanceEntry.date || new Date().toISOString().slice(0, 10),
    amount: advanceEntry.amount,
    method: "bank",
    referenceCode: advanceEntry.referenceCode || "",
    slip: advanceEntry.slip || {},
    source: "invoice-advance",
    sourceRef,
    notes: `Invoice advance for ${invoice.invoiceNumber || ""}`.trim(),
  });

  const errors = validatePaymentPayload(payload);
  if (errors.length) throw new Error(errors.join(". "));

  const payment = await CustomerPayment.create({
    ...payload,
    paymentNumber: await generatePaymentNumber(),
  });
  await postCustomerPaymentJournal(payment);
  return payment;
}

export const createCustomerPayment = async (req, res) => {
  try {
    const data = cleanPayload(req.body);
    if (data.invoiceId || data.invoiceNumber) {
      const invoice = data.invoiceId
        ? await Invoice.findById(data.invoiceId)
        : await Invoice.findOne({ invoiceNumber: data.invoiceNumber });
      if (invoice) {
        data.invoiceNumber ||= invoice.invoiceNumber || "";
        data.bookingId = invoice.bookingId || data.bookingId || "";
        data.customerId ||= invoice.customerId || null;
        data.customer = {
          name: data.customer.name || invoice.billTo?.name || "",
          email: data.customer.email || invoice.billTo?.email || "",
          phone: data.customer.phone || invoice.billTo?.mobile || "",
          address: data.customer.address || invoice.billTo?.address || "",
        };
      }
    }
    const bookingRef = await resolveBookingId(data.bookingId);
    if (bookingRef.error) {
      return res.status(400).json({ success: false, message: bookingRef.error, data: null });
    }
    data.bookingId = bookingRef.bookingId;

    const errors = [
      ...validatePaymentPayload(data),
      ...(await validateCustomerPaymentBusinessRules(data)),
    ];
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    const payment = await CustomerPayment.create({
      ...data,
      paymentNumber: await generatePaymentNumber(),
    });
    await postCustomerPaymentJournal(payment, req.user);
    return res.status(201).json({ success: true, message: "Customer payment recorded", data: payment });
  } catch (error) {
    console.error("createCustomerPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to record customer payment.", data: null });
  }
};

export const getAllCustomerPayments = async (req, res) => {
  try {
    const { search, customerId, invoiceId, invoiceNumber, status = "posted", from, to, page, limit } = req.query;
    const filter = {};

    if (status && ["posted", "void"].includes(status)) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (invoiceId) filter.invoiceId = invoiceId;
    if (invoiceNumber) filter.invoiceNumber = String(invoiceNumber).trim().toUpperCase();
    if (from || to) {
      filter.paymentDate = {};
      if (from) filter.paymentDate.$gte = String(from);
      if (to) filter.paymentDate.$lte = String(to);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { paymentNumber: { $regex: escaped, $options: "i" } },
        { invoiceNumber: { $regex: escaped, $options: "i" } },
        { bookingId: { $regex: escaped, $options: "i" } },
        { "customer.name": { $regex: escaped, $options: "i" } },
        { referenceCode: { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;
    if (!wantsPagination) {
      const payments = await CustomerPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 });
      return res.status(200).json({ success: true, data: payments });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      CustomerPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limitNum),
      CustomerPayment.countDocuments(filter),
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
    console.error("getAllCustomerPayments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer payments.", data: null });
  }
};

export const getCustomerPaymentById = async (req, res) => {
  try {
    const payment = await CustomerPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Customer payment not found", data: null });
    }
    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error("getCustomerPaymentById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch customer payment.", data: null });
  }
};

export const updateCustomerPayment = async (req, res) => {
  try {
    const existing = await CustomerPayment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Customer payment not found", data: null });
    }
    if (existing.status === "void") {
      return res.status(400).json({ success: false, message: "Voided payments cannot be edited.", data: null });
    }
    if (existing.source !== "manual") {
      return res.status(400).json({ success: false, message: "Only manual customer payments can be edited here.", data: null });
    }

    const data = cleanPayload({
      ...existing.toObject(),
      ...req.body,
      source: existing.source,
      sourceRef: existing.sourceRef,
    });

    if (data.invoiceId || data.invoiceNumber) {
      const invoice = data.invoiceId
        ? await Invoice.findById(data.invoiceId)
        : await Invoice.findOne({ invoiceNumber: data.invoiceNumber });
      if (invoice) {
        data.invoiceNumber ||= invoice.invoiceNumber || "";
        data.bookingId = invoice.bookingId || data.bookingId || "";
        data.customerId ||= invoice.customerId || null;
        data.customer = {
          name: data.customer.name || invoice.billTo?.name || "",
          email: data.customer.email || invoice.billTo?.email || "",
          phone: data.customer.phone || invoice.billTo?.mobile || "",
          address: data.customer.address || invoice.billTo?.address || "",
        };
      }
    }
    const bookingRef = await resolveBookingId(data.bookingId);
    if (bookingRef.error) {
      return res.status(400).json({ success: false, message: bookingRef.error, data: null });
    }
    data.bookingId = bookingRef.bookingId;

    const errors = [
      ...validatePaymentPayload(data),
      ...(await validateCustomerPaymentBusinessRules(data, req.params.id)),
    ];
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    const payment = await CustomerPayment.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    );
    await postCustomerPaymentJournal(payment, req.user);
    return res.status(200).json({ success: true, message: "Customer payment updated", data: payment });
  } catch (error) {
    console.error("updateCustomerPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to update customer payment.", data: null });
  }
};

export const voidCustomerPayment = async (req, res) => {
  try {
    const payment = await CustomerPayment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "void", notes: req.body?.notes || "" } },
      { returnDocument: "after", runValidators: true },
    );
    if (!payment) {
      return res.status(404).json({ success: false, message: "Customer payment not found", data: null });
    }
    await reverseJournalEntry({
      sourceEntity: "customer-payment",
      sourceId: payment._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Customer payment ${payment.paymentNumber || ""} voided`.trim(),
      user: req.user,
    });
    return res.status(200).json({ success: true, message: "Customer payment voided", data: payment });
  } catch (error) {
    console.error("voidCustomerPayment error:", error);
    return res.status(400).json({ success: false, message: "Failed to void customer payment.", data: null });
  }
};
