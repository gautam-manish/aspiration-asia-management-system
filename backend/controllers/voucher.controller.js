import Voucher from "../models/voucher.model.js";

// ─────────────────────────────────────────
// @desc    Create Voucher
// @route   POST /api/vouchers
// ─────────────────────────────────────────
export const createVoucher = async (req, res) => {
  try {
    const {
      guestName, nationality, bookingId,
      contactNumber, mealInstruction, wheelChair, arrivalFlightDetails, preferredFloor,
      pax, hotels,
    } = req.body;

    if (!guestName) {
      return res.status(400).json({ success: false, message: "Guest name is required", data: null });
    }
    if (!hotels || hotels.length === 0) {
      return res.status(400).json({ success: false, message: "At least one hotel entry is required", data: null });
    }

    const voucher = await Voucher.create({
      guestName, nationality, bookingId,
      contactNumber, mealInstruction, wheelChair, arrivalFlightDetails, preferredFloor,
      pax, hotels,
    });

    res.status(201).json({ success: true, message: "Voucher created successfully", data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Vouchers (search by guest name or date)
// @route   GET /api/vouchers?search=john&date=2024-01-01
// ─────────────────────────────────────────
export const getAllVouchers = async (req, res) => {
  try {
    const { search, date } = req.query;
    const query = {};

    if (search) {
      query.guestName = { $regex: search, $options: "i" };
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const vouchers = await Voucher.find(query).sort({ createdAt: -1 });

    res.status(200).json({ success: true, message: "Vouchers fetched successfully", data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Voucher by ID
// @route   GET /api/vouchers/:id
// ─────────────────────────────────────────
export const getVoucherById = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found", data: null });
    }
    res.status(200).json({ success: true, message: "Voucher fetched successfully", data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Voucher by ID
// @route   PUT /api/vouchers/:id
// ─────────────────────────────────────────
export const updateVoucher = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "No data provided to update", data: null });
    }

    const voucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: "after", runValidators: true }
    );

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found", data: null });
    }

    res.status(200).json({ success: true, message: "Voucher updated successfully", data: voucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
  }
};