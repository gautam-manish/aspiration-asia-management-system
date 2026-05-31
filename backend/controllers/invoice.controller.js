import Invoice from "../models/invoice.model.js";

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
    res.status(500).json({ success: false, message: error.message, data: null });
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
    const invoice = await Invoice.findOne({ invoiceNumber: { $regex: `^${invoiceNumber}$`, $options: "i" } });
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    }
    res.status(200).json({ success: true, message: "Invoice fetched successfully", data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(400).json({ success: false, message: error.message, data: null });
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
      query.$or = [
        { "billTo.name":  { $regex: search, $options: "i" } },
        { bookingId:      { $regex: search, $options: "i" } },
        { invoiceNumber:  { $regex: search, $options: "i" } },
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
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
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

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { returnDocument: 'after', runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found", data: null });
    res.status(200).json({ success: true, message: "Invoice updated successfully", data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};