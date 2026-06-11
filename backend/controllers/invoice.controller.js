import Invoice from "../models/invoice.model.js";
import SalesRecord from "../models/sales-record.model.js";
import fs from "fs";
import path from "path";
import { ADVANCE_ROOT } from "../middleware/upload.middleware.js";
import escapeRegex from "../utils/escapeRegex.js";
import CustomerPayment from "../models/customer-payment.model.js";
import { createCustomerPaymentFromInvoiceAdvance } from "./customer-payment.controller.js";
import { postCustomerPaymentJournal, postInvoiceJournal, reverseJournalEntry } from "../services/journal.service.js";
import { resolveBookingId } from "../utils/bookingRef.js";

// ─────────────────────────────────────────
// Helper: generate a unique 8-digit ASA invoice number
// Format: ASA{8-digit random}, e.g. ASA47821396
// Retries up to 10 times in the unlikely case of collision.
// ─────────────────────────────────────────
async function generateUniqueInvoiceNumber() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const eightDigits = Math.floor(10000000 + Math.random() * 90000000);
    const candidate = `ASA${eightDigits}`;
    const exists = await Invoice.exists({ invoiceNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Failed to generate unique invoice number after 10 attempts");
}

const toDateOnly = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const calculateDueDate = (invoiceDate, paymentTermsDays = 0) => {
  const cleanDate = toDateOnly(invoiceDate);
  if (!cleanDate) return "";
  const d = new Date(`${cleanDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Number(paymentTermsDays) || 0));
  return d.toISOString().slice(0, 10);
};

const applyInvoiceTerms = (payload = {}) => {
  const next = { ...payload };
  next.paymentTermsDays = Math.max(0, Number(next.paymentTermsDays) || 0);
  next.dueDate = toDateOnly(next.dueDate) || calculateDueDate(next.invoiceDate, next.paymentTermsDays);
  return next;
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const daysBetween = (from, to) => {
  const a = new Date(`${from}T00:00:00.000Z`);
  const b = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
};

const paymentIdentity = (payment = {}) => [
  String(payment.referenceCode || "").trim().toLowerCase(),
  String(payment.date || "").trim(),
  roundMoney(payment.amount),
].join("|");

const invoicePaymentStatus = ({ total, paid }) => {
  if (paid <= 0.009) return "unpaid";
  if (paid + 0.009 < total) return "partial";
  return "paid";
};

const attachPaymentSummary = async (invoicesInput) => {
  const isArray = Array.isArray(invoicesInput);
  const invoices = isArray ? invoicesInput : [invoicesInput].filter(Boolean);
  if (invoices.length === 0) return isArray ? [] : null;

  const invoiceObjects = invoices.map((invoice) => (
    typeof invoice.toObject === "function" ? invoice.toObject() : { ...invoice }
  ));
  const invoiceIds = invoiceObjects.map((invoice) => invoice._id).filter(Boolean);
  const invoiceNumbers = invoiceObjects
    .map((invoice) => String(invoice.invoiceNumber || "").toUpperCase())
    .filter(Boolean);
  const salesRecords = await SalesRecord.find({
    invoiceNumber: { $in: invoiceNumbers },
  }).select("invoiceNumber paymentEntries").lean();
  const salesPaymentsByInvoiceNumber = new Map(
    salesRecords.map((record) => [String(record.invoiceNumber || "").toUpperCase(), record.paymentEntries || []]),
  );

  const payments = await CustomerPayment.find({
    status: "posted",
    $or: [
      { invoiceId: { $in: invoiceIds } },
      { invoiceNumber: { $in: invoiceNumbers } },
    ],
  }).select("invoiceId invoiceNumber amount source sourceRef").lean();

  const paidByInvoiceId = new Map();
  const paidByInvoiceNumber = new Map();
  const advanceRefsByInvoiceId = new Map();
  const advanceRefsByInvoiceNumber = new Map();

  for (const payment of payments) {
    if (payment.source === "sales-record") continue;
    const amount = Number(payment.amount) || 0;
    const idKey = payment.invoiceId ? String(payment.invoiceId) : "";
    const numberKey = payment.invoiceNumber ? String(payment.invoiceNumber).toUpperCase() : "";
    const paidMap = idKey ? paidByInvoiceId : paidByInvoiceNumber;
    const paidKey = idKey || numberKey;
    if (!paidKey) continue;
    paidMap.set(paidKey, (paidMap.get(paidKey) || 0) + amount);

    if (payment.source === "invoice-advance" && payment.sourceRef) {
      const refMap = idKey ? advanceRefsByInvoiceId : advanceRefsByInvoiceNumber;
      const refs = refMap.get(paidKey) || new Set();
      refs.add(String(payment.sourceRef));
      refMap.set(paidKey, refs);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const enriched = invoiceObjects.map((invoice) => {
    const idKey = invoice._id ? String(invoice._id) : "";
    const numberKey = String(invoice.invoiceNumber || "").toUpperCase();
    const postedPaid = (idKey ? paidByInvoiceId.get(idKey) : 0) || paidByInvoiceNumber.get(numberKey) || 0;
    const postedAdvanceRefs = (idKey ? advanceRefsByInvoiceId.get(idKey) : null) || advanceRefsByInvoiceNumber.get(numberKey) || new Set();
    const legacyAdvancePaid = (invoice.advancePayments || []).reduce((sum, advance) => {
      const ref = String(advance._id || "");
      return postedAdvanceRefs.has(ref) ? sum : sum + (Number(advance.amount) || 0);
    }, 0);
    const invoiceAdvanceKeys = new Set((invoice.advancePayments || []).map(paymentIdentity));
    const salesRecordPaid = (salesPaymentsByInvoiceNumber.get(numberKey) || [])
      .filter((payment) => !invoiceAdvanceKeys.has(paymentIdentity(payment)))
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const total = roundMoney(invoice.total);
    const paid = roundMoney(postedPaid + legacyAdvancePaid + salesRecordPaid);
    const balance = roundMoney(total - paid);
    const dueDate = toDateOnly(invoice.dueDate) || calculateDueDate(invoice.invoiceDate, invoice.paymentTermsDays);
    const overdueDays = balance > 0 && dueDate && dueDate < today ? daysBetween(dueDate, today) : 0;

    return {
      ...invoice,
      dueDate,
      salesRecordPaymentEntries: salesPaymentsByInvoiceNumber.get(numberKey) || [],
      paymentSummary: {
        total,
        paid,
        balance: Math.max(0, balance),
        overdueDays,
        status: invoicePaymentStatus({ total, paid }),
      },
    };
  });

  return isArray ? enriched : enriched[0];
};

async function syncSalesRecordHeaderFromInvoice(invoice) {
  if (!invoice?.invoiceNumber) return;
  const invoiceNumber = String(invoice.invoiceNumber || "").trim().toUpperCase();
  const record = await SalesRecord.findOne({ invoiceNumber });
  if (!record) return;

  record.clientName = invoice.billTo?.name || record.clientName || "(Unknown)";
  record.bookingId = invoice.bookingId || record.bookingId || "";
  record.address = invoice.billTo?.address || "";
  record.phone = invoice.billTo?.mobile || "";
  record.email = String(invoice.billTo?.email || "").toLowerCase();
  record.totalAmount = Number(invoice.total) || 0;
  await record.save();
}

// ─────────────────────────────────────────
// @desc    Get Invoice by bookingId (linked booking queryId)
// @route   GET /api/invoices/by-booking/:bookingId
// ─────────────────────────────────────────
export const getInvoiceByBookingId = async (req, res) => {
  try {
    const bookingId = (req.params.bookingId || "").trim();
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required", data: null });
    }
    // Most recent first if multiple invoices share the same bookingId
    const invoice = await Invoice.findOne({ bookingId }).sort({ createdAt: -1 });
    if (!invoice) {
      return res.status(404).json({ success: false, message: "No invoice found for this booking", data: null });
    }
    const enriched = await attachPaymentSummary(invoice);
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: enriched });
  } catch (error) {
    console.error("getInvoiceByBookingId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoice.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Invoice by invoiceNumber (case-insensitive exact match)
// @route   GET /api/invoices/by-number/:invoiceNumber
// ─────────────────────────────────────────
export const getInvoiceByNumber = async (req, res) => {
  try {
    const invoiceNumber = (req.params.invoiceNumber || "").trim();
    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required", data: null });
    }
    const invoice = await Invoice.findOne({ invoiceNumber: { $regex: `^${escapeRegex(invoiceNumber)}$`, $options: "i" } });
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    }
    const enriched = await attachPaymentSummary(invoice);
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: enriched });
  } catch (error) {
    console.error("getInvoiceByNumber error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoice.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get next unique Invoice Number
// @route   GET /api/invoices/next-number
// ─────────────────────────────────────────
export const getNextInvoiceNumber = async (req, res) => {
  try {
    const invoiceNumber = await generateUniqueInvoiceNumber();
    res.status(200).json({ success: true, message: "Next invoice number generated", data: { invoiceNumber } });
  } catch (error) {
    console.error("getNextInvoiceNumber error:", error);
    res.status(500).json({ success: false, message: "Failed to generate invoice number.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Create Invoice
// @route   POST /api/invoices
// ─────────────────────────────────────────
export const createInvoice = async (req, res) => {
  try {
    let payload = { ...req.body };
    if (payload.customerId === "") payload.customerId = null;
    const bookingRef = await resolveBookingId(payload.bookingId);
    if (bookingRef.error) return res.status(400).json({ success: false, message: bookingRef.error, data: null });
    payload.bookingId = bookingRef.bookingId;

    // Always assign a fresh, unique ASA-prefixed invoice number on the server
    // — even if the client suggested one — to avoid collisions and bypassing rules.
    payload.invoiceNumber = await generateUniqueInvoiceNumber();
    payload = applyInvoiceTerms(payload);

    const invoice = await Invoice.create(payload);
    await postInvoiceJournal(invoice, req.user);
    const enriched = await attachPaymentSummary(invoice);
    res.status(201).json({ success: true, message: "Invoice created successfully", data: enriched });
  } catch (error) {
    console.error("createInvoice error:", error);
    res.status(400).json({ success: false, message: "Failed to create invoice.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Invoices
//          - GET /api/invoices?search=&date=                  → ALL (back-compat)
//          - GET /api/invoices?search=&page=1&limit=50        → paginated envelope
// @route   GET /api/invoices?search=name&date=
// ─────────────────────────────────────────
export const getAllInvoices = async (req, res) => {
  try {
    const { search, date, page, limit } = req.query;
    const query = {};

    if (search) {
      const escaped = escapeRegex(search);
      query.$or = [
        { "billTo.name":  { $regex: escaped, $options: "i" } },
        { "billTo.email": { $regex: escaped, $options: "i" } },
        { bookingId:      { $regex: escaped, $options: "i" } },
        { invoiceNumber:  { $regex: escaped, $options: "i" } },
      ];
    }

    if (date) {
      const start = new Date(date); start.setHours(0,0,0,0);
      const end   = new Date(date); end.setHours(23,59,59,999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const invoices = await Invoice.find(query).sort({ createdAt: -1 });
      const enriched = await attachPaymentSummary(invoices);
      return res.status(200).json({ success: true, message: "Invoices fetched successfully", data: enriched });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Invoice.countDocuments(query),
    ]);
    const enriched = await attachPaymentSummary(invoices);

    return res.status(200).json({
      success: true,
      message: "Invoices fetched successfully",
      data: enriched,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllInvoices error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoices.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Invoice
// @route   GET /api/invoices/:id
// ─────────────────────────────────────────
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    const enriched = await attachPaymentSummary(invoice);
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: enriched });
  } catch (error) {
    console.error("getInvoiceById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch invoice.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Invoice
// @route   PUT /api/invoices/:id
// ─────────────────────────────────────────
export const updateInvoice = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0)
      return res.status(400).json({ success: false, message: "No data provided", data: null });

    // Invoice number is server-generated and immutable
    delete req.body.invoiceNumber;

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = [
      "customerId", "bookingId", "clientName", "partyCompanyName", "partyContactPerson", "invoiceDate", "paymentTermsDays", "dueDate", "from", "billTo", "lineItems",
      "subtotal", "discountType", "discountValue", "discount",
      "taxApplicable", "taxPercent", "taxAmount", "totalWithTax",
      "total", "currency", "notes", "terms",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.customerId === "") updates.customerId = null;
    if (updates.bookingId !== undefined) {
      const bookingRef = await resolveBookingId(updates.bookingId);
      if (bookingRef.error) return res.status(400).json({ success: false, message: bookingRef.error, data: null });
      updates.bookingId = bookingRef.bookingId;
    }

    if (updates.invoiceDate !== undefined || updates.paymentTermsDays !== undefined || updates.dueDate !== undefined) {
      const existing = await Invoice.findById(req.params.id)
        .select("invoiceDate paymentTermsDays dueDate")
        .lean();
      if (!existing) return res.status(404).json({ success: false, message: "Invoice not found", data: null });

      const merged = applyInvoiceTerms({
        invoiceDate: updates.invoiceDate ?? existing.invoiceDate,
        paymentTermsDays: updates.paymentTermsDays ?? existing.paymentTermsDays,
        dueDate: updates.dueDate ?? "",
      });
      updates.paymentTermsDays = merged.paymentTermsDays;
      updates.dueDate = merged.dueDate;
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id, { $set: updates }, { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    await syncSalesRecordHeaderFromInvoice(invoice);
    const linkedPayments = await CustomerPayment.find({
      status: "posted",
      $or: [
        { invoiceId: invoice._id },
        { invoiceNumber: String(invoice.invoiceNumber || "").toUpperCase() },
      ],
    });
    for (const payment of linkedPayments) {
      if (payment.bookingId !== invoice.bookingId) {
        payment.bookingId = invoice.bookingId;
        await payment.save();
        await postCustomerPaymentJournal(payment, req.user);
      }
    }
    const enriched = await attachPaymentSummary(invoice);
    await postInvoiceJournal(invoice, req.user);
    res.status(200).json({ success: true, message: "Invoice updated successfully", data: enriched });
  } catch (error) {
    console.error("updateInvoice error:", error);
    res.status(400).json({ success: false, message: "Failed to update invoice.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Delete Invoice
// @route   DELETE /api/invoices/:id
// ─────────────────────────────────────────
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    await reverseJournalEntry({
      sourceEntity: "invoice",
      sourceId: invoice._id,
      entryDate: new Date().toISOString().slice(0, 10),
      memo: `Invoice ${invoice.invoiceNumber || ""} deleted`.trim(),
      user: req.user,
    });
    res.status(200).json({ success: true, message: "Invoice deleted successfully", data: null });
  } catch (error) {
    console.error("deleteInvoice error:", error);
    res.status(500).json({ success: false, message: "Failed to delete invoice.", data: null });
  }
};


// ─────────────────────────────────────────
// @desc    Upload an Advance Payment Slip
// @route   POST /api/invoices/upload-advance-slip   (multipart, field "slip")
// ─────────────────────────────────────────
export const uploadAdvanceSlip = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded", data: null });
    }
    const url = `/uploads/advance-slips/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      message: "Advance slip uploaded successfully",
      data: {
        url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size:     req.file.size,
      },
    });
  } catch (error) {
    console.error("uploadAdvanceSlip error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload slip.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Add an Advance Payment to an existing Invoice
// @route   POST /api/invoices/:id/advance
// body: { referenceCode, amount, date, slip? }
//
// Side-effect: also mirrors the advance into the matching SalesRecord
// (creating one if none exists yet) so the books stay in sync.
// ─────────────────────────────────────────
export const addAdvancePayment = async (req, res) => {
  try {
    const { referenceCode, amount, date, slip } = req.body || {};
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than zero", data: null });
    }
    const existingInvoice = await Invoice.findById(req.params.id).lean();
    if (!existingInvoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    const cleanReference = String(referenceCode || "").trim();
    if (cleanReference) {
      const duplicateAdvance = (existingInvoice.advancePayments || []).some(
        (advance) => String(advance.referenceCode || "").trim().toLowerCase() === cleanReference.toLowerCase(),
      );
      const duplicatePayment = await CustomerPayment.exists({
        status: "posted",
        referenceCode: { $regex: `^${escapeRegex(cleanReference)}$`, $options: "i" },
        $or: [
          { invoiceId: existingInvoice._id },
          { invoiceNumber: String(existingInvoice.invoiceNumber || "").toUpperCase() },
        ],
      });
      if (duplicateAdvance || duplicatePayment) {
        return res.status(400).json({ success: false, message: "A posted payment with this reference already exists for this invoice.", data: null });
      }
    }

    const postedPayments = await CustomerPayment.find({
      status: "posted",
      $or: [
        { invoiceId: existingInvoice._id },
        { invoiceNumber: String(existingInvoice.invoiceNumber || "").toUpperCase() },
      ],
    }).select("amount source sourceRef").lean();
    const mirroredAdvanceRefs = new Set(postedPayments.filter((p) => p.source === "invoice-advance" && p.sourceRef).map((p) => String(p.sourceRef)));
    const legacyAdvancePaid = (existingInvoice.advancePayments || []).reduce((sum, advance) => (
      mirroredAdvanceRefs.has(String(advance._id || "")) ? sum : sum + (Number(advance.amount) || 0)
    ), 0);
    const paidBefore = postedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) + legacyAdvancePaid;
    const outstanding = Math.round(((Number(existingInvoice.total) || 0) - paidBefore) * 100) / 100;
    if (numAmount > outstanding + 0.009) {
      return res.status(400).json({ success: false, message: `Advance exceeds invoice outstanding balance (${outstanding.toFixed(2)}).`, data: null });
    }
    const slipMeta = (slip && slip.url)
      ? {
          url:      String(slip.url      || "").trim(),
          fileName: String(slip.fileName || "").trim(),
          mimeType: String(slip.mimeType || "").trim(),
          size:     Number(slip.size) || 0,
        }
      : { url: "", fileName: "", mimeType: "", size: 0 };

    const entry = {
      referenceCode: String(referenceCode || "").trim(),
      amount:        Math.round(numAmount * 100) / 100,
      date:          String(date || "").trim(),
      slip:          slipMeta,
    };
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $push: { advancePayments: entry } },
      { returnDocument: "after", runValidators: true },
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });

    // ── Sync into Sales Record (best-effort) ────────────────────────────
    // If a SalesRecord already exists for this invoiceNumber → append the entry.
    // Otherwise → create one using the invoice's bill-to details and totals.
    try {
      const invoiceNumber = (invoice.invoiceNumber || "").trim().toUpperCase();
      if (invoiceNumber) {
        const paymentEntry = {
          referenceCode: entry.referenceCode,
          amount:        entry.amount,
          date:          entry.date,
          slip:          { ...slipMeta },
        };
        const existing = await SalesRecord.findOne({ invoiceNumber });
        if (existing) {
          existing.bookingId = invoice.bookingId || existing.bookingId || "";
          existing.paymentEntries.push(paymentEntry);
          await existing.save(); // pre-save hook recomputes received + outstanding
        } else {
          const sr = new SalesRecord({
            invoiceNumber,
            bookingId:   invoice.bookingId || "",
            clientName:  invoice.billTo?.name    || "(Unknown)",
            address:     invoice.billTo?.address || "",
            phone:       invoice.billTo?.mobile  || "",
            email:       (invoice.billTo?.email  || "").toLowerCase(),
            totalAmount: Number(invoice.total) || 0,
            paymentEntries: [paymentEntry],
          });
          await sr.save();
        }
      }
    } catch (syncErr) {
      // Don't fail the whole request — advance is already recorded on the invoice.
      // Surface it in the server log so we can investigate later.
      console.warn("Sales-record sync failed for invoice", invoice.invoiceNumber, ":", syncErr.message);
    }

    try {
      const added = invoice.advancePayments?.[invoice.advancePayments.length - 1];
      if (added) await createCustomerPaymentFromInvoiceAdvance(invoice, added);
    } catch (paymentErr) {
      console.warn("Customer-payment sync failed for invoice", invoice.invoiceNumber, ":", paymentErr.message);
    }

    const enriched = await attachPaymentSummary(invoice);
    res.status(201).json({ success: true, message: "Advance payment added", data: enriched });
  } catch (error) {
    console.error("addAdvancePayment error:", error);
    res.status(400).json({ success: false, message: "Failed to add advance payment.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Remove an Advance Payment from an Invoice
// @route   DELETE /api/invoices/:id/advance/:advanceId
//
// Side-effect: also removes the matching entry from the SalesRecord so totals
// stay in sync. Match heuristic = (referenceCode, amount, date).
// ─────────────────────────────────────────
export const removeAdvancePayment = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });

    const adv = invoice.advancePayments.id(req.params.advanceId);
    if (!adv) return res.status(404).json({ success: false, message: "Advance payment not found", data: null });

    // Best-effort: remove the slip file from disk if one was attached.
    if (adv.slip && adv.slip.url && adv.slip.url.startsWith("/uploads/advance-slips/")) {
      const filename = path.basename(adv.slip.url);
      const filePath = path.join(ADVANCE_ROOT, filename);
      fs.promises.unlink(filePath).catch(() => { /* file may already be gone */ });
    }

    // Snapshot before pulling so we can mirror the removal in SalesRecord.
    const snapshot = {
      referenceCode: adv.referenceCode || "",
      amount:        Number(adv.amount) || 0,
      date:          adv.date || "",
      invoiceNumber: (invoice.invoiceNumber || "").trim().toUpperCase(),
    };

    invoice.advancePayments.pull({ _id: req.params.advanceId });
    await invoice.save();

    // Mirror removal into SalesRecord (best-effort)
    try {
      if (snapshot.invoiceNumber) {
        const sr = await SalesRecord.findOne({ invoiceNumber: snapshot.invoiceNumber });
        if (sr) {
          // Find the first matching payment entry and pull it out.
          const idx = sr.paymentEntries.findIndex((p) =>
            (p.referenceCode || "") === snapshot.referenceCode &&
            Number(p.amount || 0) === snapshot.amount &&
            (p.date || "") === snapshot.date
          );
          if (idx !== -1) {
            sr.paymentEntries.splice(idx, 1);
            await sr.save(); // pre-save hook recomputes totals
          }
        }
      }
    } catch (syncErr) {
      console.warn("Sales-record removal sync failed:", syncErr.message);
    }

    try {
      if (snapshot.invoiceNumber && req.params.advanceId) {
        await CustomerPayment.findOneAndUpdate(
          { source: "invoice-advance", sourceRef: req.params.advanceId },
          { $set: { status: "void", notes: "Voided after invoice advance removal" } },
          { returnDocument: "after" },
        );
      }
    } catch (paymentErr) {
      console.warn("Customer-payment removal sync failed:", paymentErr.message);
    }

    const enriched = await attachPaymentSummary(invoice);
    res.status(200).json({ success: true, message: "Advance payment removed", data: enriched });
  } catch (error) {
    console.error("removeAdvancePayment error:", error);
    res.status(500).json({ success: false, message: "Failed to remove advance payment.", data: null });
  }
};
