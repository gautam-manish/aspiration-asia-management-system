import SalesRecord from "../models/sales-record.model.js";
import fs from "fs";
import path from "path";
import { UPLOAD_ROOT } from "../middleware/upload.middleware.js";
import escapeRegex from "../utils/escapeRegex.js";

// ─────────────────────────────────────────
//  Helper: sanitise payment entries array
// ─────────────────────────────────────────
const sanitiseEntries = (entries) => {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => ({
    referenceCode: (e.referenceCode || "").trim(),
    amount:        Math.max(0, Number(e.amount) || 0),
    date:          (e.date || "").trim(),
    // Preserve the slip metadata exactly as the client sent it. The actual
    // bytes were already uploaded via the dedicated upload endpoint.
    slip: e.slip && e.slip.url
      ? {
          url:      String(e.slip.url      || "").trim(),
          fileName: String(e.slip.fileName || "").trim(),
          mimeType: String(e.slip.mimeType || "").trim(),
          size:     Number(e.slip.size)    || 0,
        }
      : { url: "", fileName: "", mimeType: "", size: 0 },
  }));
};

// ─────────────────────────────────────────
// @desc    Create Sales Record
// @route   POST /api/salesrecords
// ─────────────────────────────────────────
export const createSalesRecord = async (req, res) => {
  try {
    const {
      invoiceNumber, clientName, address,
      phone, email, totalAmount, paymentEntries,
    } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required", data: null });
    }
    if (!clientName) {
      return res.status(400).json({ success: false, message: "Client name is required", data: null });
    }

    // Duplicate invoice check
    const existing = await SalesRecord.findOne({
      invoiceNumber: invoiceNumber.trim().toUpperCase(),
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Invoice "${invoiceNumber}" is already in the sales record (${existing.clientName})`,
        data: null,
      });
    }

    const sanitised          = sanitiseEntries(paymentEntries);
    const receivedAmount     = sanitised.reduce((s, e) => s + e.amount, 0);
    const outstandingBalance = (Number(totalAmount) || 0) - receivedAmount;

    const record = await SalesRecord.create({
      invoiceNumber:    invoiceNumber.trim().toUpperCase(),
      clientName:       clientName.trim(),
      address:          address?.trim()             || "",
      phone:            phone?.trim()               || "",
      email:            email?.trim().toLowerCase() || "",
      totalAmount:      Number(totalAmount)          || 0,
      receivedAmount,
      outstandingBalance,
      paymentEntries:   sanitised,
    });

    res.status(201).json({ success: true, message: "Sales record created successfully", data: record });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with this invoice number already exists", data: null });
    }
    console.error("createSalesRecord error:", error);
    res.status(500).json({ success: false, message: "Failed to create sales record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sales Records
//          - GET /api/salesrecords?search=abc                    → ALL (back-compat)
//          - GET /api/salesrecords?search=&page=1&limit=50       → paginated envelope
// @route   GET /api/salesrecords?search=abc
// ─────────────────────────────────────────
export const getAllSalesRecords = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const filter = {};

    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { clientName:    { $regex: escaped, $options: "i" } },
        { invoiceNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const records = await SalesRecord.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, message: "Sales records fetched successfully", data: records });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      SalesRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      SalesRecord.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Sales records fetched successfully",
      data: records,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllSalesRecords error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales records.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Sales Record by ID
// @route   GET /api/salesrecords/:id
// ─────────────────────────────────────────
export const getSalesRecordById = async (req, res) => {
  try {
    const record = await SalesRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found", data: null });
    }
    res.status(200).json({ success: true, message: "Sales record fetched successfully", data: record });
  } catch (error) {
    console.error("getSalesRecordById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Sales Record by Invoice Number (case-insensitive exact match)
// @route   GET /api/salesrecords/by-invoice/:invoiceNumber
// ─────────────────────────────────────────
export const getSalesRecordByInvoiceNumber = async (req, res) => {
  try {
    const invoiceNumber = (req.params.invoiceNumber || "").trim();
    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: "Invoice number is required", data: null });
    }
    const record = await SalesRecord.findOne({
      invoiceNumber: invoiceNumber.toUpperCase(),
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "No sales record for this invoice", data: null });
    }
    res.status(200).json({ success: true, message: "Sales record fetched successfully", data: record });
  } catch (error) {
    console.error("getSalesRecordByInvoiceNumber error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Sales Record by ID
//          invoiceNumber is immutable — ignored if sent
// @route   PUT /api/salesrecords/:id
// ─────────────────────────────────────────
export const updateSalesRecord = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "No data provided to update", data: null });
    }

    const { clientName, address, phone, email, totalAmount, paymentEntries } = req.body;

    if (!clientName) {
      return res.status(400).json({ success: false, message: "Client name is required", data: null });
    }

    const sanitised          = sanitiseEntries(paymentEntries);
    const receivedAmount     = sanitised.reduce((s, e) => s + e.amount, 0);
    const outstandingBalance = (Number(totalAmount) || 0) - receivedAmount;

    // invoiceNumber is intentionally excluded from $set — it is immutable
    const record = await SalesRecord.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          clientName:        clientName.trim(),
          address:           address?.trim()             || "",
          phone:             phone?.trim()               || "",
          email:             email?.trim().toLowerCase() || "",
          totalAmount:       Number(totalAmount)          || 0,
          receivedAmount,
          outstandingBalance,
          paymentEntries:    sanitised,
        },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found", data: null });
    }

    res.status(200).json({ success: true, message: "Sales record updated successfully", data: record });
  } catch (error) {
    console.error("updateSalesRecord error:", error);
    res.status(400).json({ success: false, message: "Failed to update sales record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Delete Sales Record by ID
// @route   DELETE /api/salesrecords/:id
// ─────────────────────────────────────────
export const deleteSalesRecord = async (req, res) => {
  try {
    const record = await SalesRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found", data: null });
    }
    res.status(200).json({ success: true, message: "Sales record deleted successfully", data: null });
  } catch (error) {
    console.error("deleteSalesRecord error:", error);
    res.status(500).json({ success: false, message: "Failed to delete sales record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Upload Payment Slip (PDF / JPG / JPEG)
// @route   POST /api/salesrecords/upload-slip   (multipart/form-data, field: "slip")
//
// Stores the file on disk under /uploads/payment-slips/ and returns its
// public URL + metadata. The frontend then attaches that metadata to the
// matching paymentEntry when it saves the sales record.
// ─────────────────────────────────────────
export const uploadPaymentSlip = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded", data: null });
    }
    const url = `/uploads/payment-slips/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      message: "Payment slip uploaded successfully",
      data: {
        url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size:     req.file.size,
      },
    });
  } catch (error) {
    console.error("uploadPaymentSlip error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload slip.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Delete a previously-uploaded payment slip from disk.
//          Used when the user removes a slip from a payment entry.
// @route   DELETE /api/salesrecords/slip?url=/uploads/payment-slips/abc.pdf
// ─────────────────────────────────────────
export const removePaymentSlip = async (req, res) => {
  try {
    const url = (req.query.url || "").trim();
    if (!url || !url.startsWith("/uploads/payment-slips/")) {
      return res.status(400).json({ success: false, message: "Invalid slip url", data: null });
    }
    const filename = path.basename(url); // strip dirs to prevent traversal
    const filePath = path.join(UPLOAD_ROOT, filename);
    fs.promises.unlink(filePath).catch(() => { /* file may already be gone */ });
    return res.status(200).json({ success: true, message: "Slip removed", data: null });
  } catch (error) {
    console.error("removePaymentSlip error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove slip.", data: null });
  }
};
