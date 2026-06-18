import Voucher from "../models/voucher.model.js";
import escapeRegex from "../utils/escapeRegex.js";
import mongoose from "mongoose";

const generateConfirmationNumber = () => Math.floor(100000 + Math.random() * 900000).toString();

function normaliseHotels(hotels = []) {
  return (Array.isArray(hotels) ? hotels : []).map((hotel) => ({
    ...hotel,
    confirmationNumber: String(hotel?.confirmationNumber || "").replace(/\D/g, "").slice(0, 6) || generateConfirmationNumber(),
  }));
}

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
      pax, hotels: normaliseHotels(hotels),
    });

    res.status(201).json({ success: true, message: "Voucher created successfully", data: voucher });
  } catch (error) {
    console.error("createVoucher error:", error);
    res.status(500).json({ success: false, message: "Failed to create voucher.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Vouchers (search by guest name, booking ID, or date).
//          - GET /api/vouchers?search=&date=                  → returns ALL matching (back-compat)
//          - GET /api/vouchers?search=&date=&page=1&limit=50  → paginated; envelope adds total/page/limit/totalPages
// @route   GET /api/vouchers
// ─────────────────────────────────────────
export const getAllVouchers = async (req, res) => {
  try {
    const { search, date, page, limit } = req.query;
    const query = {};

    if (search) {
      const escaped = escapeRegex(search);
      query.$or = [
        { guestName: { $regex: escaped, $options: "i" } },
        { bookingId: { $regex: escaped, $options: "i" } },
      ];
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const vouchers = await Voucher.find(query).sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        message: "Vouchers fetched successfully",
        data: vouchers,
      });
    }

    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [vouchers, total] = await Promise.all([
      Voucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Voucher.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Vouchers fetched successfully",
      data: vouchers,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllVouchers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch vouchers.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Voucher by ID
// @route   GET /api/vouchers/:id
// ─────────────────────────────────────────
export const getVoucherById = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const lookup = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { bookingId: id }] }
      : { bookingId: id };

    const voucher = await Voucher.findOne(lookup).sort({ createdAt: -1 });
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found", data: null });
    }
    res.status(200).json({ success: true, message: "Voucher fetched successfully", data: voucher });
  } catch (error) {
    console.error("getVoucherById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch voucher.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Voucher by bookingId
// @route   GET /api/vouchers/by-booking/:bookingId
// ─────────────────────────────────────────
export const getVoucherByBookingId = async (req, res) => {
  try {
    const bookingId = (req.params.bookingId || "").trim();
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required", data: null });
    }
    const voucher = await Voucher.findOne({ bookingId }).sort({ createdAt: -1 });
    if (!voucher) {
      return res.status(404).json({ success: false, message: "No voucher found for this booking", data: null });
    }
    res.status(200).json({ success: true, message: "Voucher fetched successfully", data: voucher });
  } catch (error) {
    console.error("getVoucherByBookingId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch voucher.", data: null });
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

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = [
      "guestName", "nationality", "bookingId", "contactNumber",
      "mealInstruction", "wheelChair", "arrivalFlightDetails",
      "preferredFloor", "pax", "hotels",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.hotels) updates.hotels = normaliseHotels(updates.hotels);

    const voucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found", data: null });
    }

    res.status(200).json({ success: true, message: "Voucher updated successfully", data: voucher });
  } catch (error) {
    console.error("updateVoucher error:", error);
    res.status(400).json({ success: false, message: "Failed to update voucher.", data: null });
  }
};
