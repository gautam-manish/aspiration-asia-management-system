import Invoice from "../models/invoice.model.js";
import SalesRecord from "../models/sales-record.model.js";
import fs from "fs";
import path from "path";
import { ADVANCE_ROOT } from "../middleware/upload.middleware.js";
import escapeRegex from "../utils/escapeRegex.js";

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
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: invoice });
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
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: invoice });
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
    const payload = { ...req.body };

    // Always assign a fresh, unique ASA-prefixed invoice number on the server
    // — even if the client suggested one — to avoid collisions and bypassing rules.
    payload.invoiceNumber = await generateUniqueInvoiceNumber();

    const invoice = await Invoice.create(payload);
    res.status(201).json({ success: true, message: "Invoice created successfully", data: invoice });
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
      return res.status(200).json({ success: true, message: "Invoices fetched successfully", data: invoices });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Invoice.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Invoices fetched successfully",
      data: invoices,
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
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: invoice });
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
      "bookingId", "date", "billTo", "currency", "entries",
      "subtotal", "discount", "total", "note",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id, { $set: updates }, { returnDocument: 'after', runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    res.status(200).json({ success: true, message: "Invoice updated successfully", data: invoice });
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
          existing.paymentEntries.push(paymentEntry);
          await existing.save(); // pre-save hook recomputes received + outstanding
        } else {
          const sr = new SalesRecord({
            invoiceNumber,
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

    res.status(201).json({ success: true, message: "Advance payment added", data: invoice });
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

    res.status(200).json({ success: true, message: "Advance payment removed", data: invoice });
  } catch (error) {
    console.error("removeAdvancePayment error:", error);
    res.status(500).json({ success: false, message: "Failed to remove advance payment.", data: null });
  }
};
