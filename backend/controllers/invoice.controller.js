import Invoice from "../models/invoice.model.js";

// ─────────────────────────────────────────
// @desc    Create Invoice
// @route   POST /api/invoices
// ─────────────────────────────────────────
export const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    res.status(201).json({ success: true, message: "Invoice created successfully", data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Invoices
// @route   GET /api/invoices?search=name&date=
// ─────────────────────────────────────────
export const getAllInvoices = async (req, res) => {
  try {
    const { search, date } = req.query;
    const query = {};

    if (search) query["billTo.name"] = { $regex: search, $options: "i" };

    if (date) {
      const start = new Date(date); start.setHours(0,0,0,0);
      const end   = new Date(date); end.setHours(23,59,59,999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "Invoices fetched successfully", data: invoices });
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