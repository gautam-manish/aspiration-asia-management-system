import SalesRecord from "../models/sales-record.model.js";

// ─────────────────────────────────────────
//  Helper: sanitise payment entries array
// ─────────────────────────────────────────
const sanitiseEntries = (entries) => {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => ({
    referenceCode: (e.referenceCode || "").trim(),
    amount:        Math.max(0, Number(e.amount) || 0),
    date:          (e.date || "").trim(),
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
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sales Records
//          Search: clientName or invoiceNumber
// @route   GET /api/salesrecords?search=abc
// ─────────────────────────────────────────
export const getAllSalesRecords = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { clientName:    { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
      ];
    }

    const records = await SalesRecord.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "Sales records fetched successfully", data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
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
    res.status(400).json({ success: false, message: error.message, data: null });
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
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};