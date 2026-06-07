import Booking from "../models/booking.model.js";
import escapeRegex from "../utils/escapeRegex.js";

// ─────────────────────────────────────────
// Helper: generate next Booking ID
// Format: ASA{year}{runningNumber}
// Running number starts at 100 and is global
// (not reset per year — just the prefix changes)
// ─────────────────────────────────────────
async function generateQueryId() {
  const year = new Date().getFullYear();
  const prefix = `ASA${year}`;

  // Count ALL bookings that have this year's prefix
  const count = await Booking.countDocuments({
    queryId: { $regex: `^${prefix}` },
  });

  return `${prefix}${100 + count}`;
}

// ─────────────────────────────────────────
// @desc    Get next Booking ID (for frontend display)
// @route   GET /api/bookings/next-id
// ─────────────────────────────────────────
export const getNextBookingId = async (req, res) => {
  try {
    const queryId = await generateQueryId();
    res
      .status(200)
      .json({
        success: true,
        message: "Next booking ID generated",
        data: null,
        queryId,
      });
  } catch (error) {
    console.error("getNextBookingId error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate booking ID.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Create Booking
// @route   POST /api/bookings
// ─────────────────────────────────────────
export const createBooking = async (req, res) => {
  try {
    const {
      queryId: providedId,
      customerId,
      clientName,
      email,
      mobile,
      address,
      destination,
      pickupPoint,
      dropPoint,
      arrivalDate,
      departureDate,
      noOfDays,
      adults,
      childEB,
      childNoEB,
      childU5,
      rooms,
      hotelCategory,
      mealPlan,
    } = req.body;

    if (!clientName) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Client / Agent name is required",
          data: null,
        });
    }
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required", data: null });
    }
    if (!destination) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Destination is required",
          data: null,
        });
    }

    // Use provided ID or generate one (handles race conditions gracefully)
    let queryId = providedId;
    if (!queryId) {
      queryId = await generateQueryId();
    } else {
      // Make sure provided ID isn't already taken (race condition)
      const exists = await Booking.findOne({ queryId });
      if (exists) queryId = await generateQueryId();
    }

    const booking = await Booking.create({
      queryId,
      customerId: customerId || null,
      clientName,
      email,
      mobile,
      address,
      destination,
      pickupPoint,
      dropPoint,
      arrivalDate: arrivalDate ? new Date(arrivalDate) : undefined,
      departureDate: departureDate ? new Date(departureDate) : undefined,
      noOfDays,
      adults: Number(adults) || 0,
      childEB: Number(childEB) || 0,
      childNoEB: Number(childNoEB) || 0,
      childU5: Number(childU5) || 0,
      rooms: Number(rooms) || 0,
      hotelCategory: hotelCategory || "",
      mealPlan: mealPlan || "",
      status: "confirmed",
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Booking created successfully",
        data: booking,
      });
  } catch (error) {
    console.error("createBooking error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create booking.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Bookings
//          - GET /api/bookings?status=confirmed&search=john          → ALL (back-compat)
//          - GET /api/bookings?status=confirmed&page=1&limit=50      → paginated envelope
// @route   GET /api/bookings?status=confirmed&search=john
// ─────────────────────────────────────────
export const getAllBookings = async (req, res) => {
  try {
    const { status, search, date, page, limit } = req.query;
    const filter = {};

    // Status filter (default: confirmed)
    if (status && ["confirmed", "cancelled"].includes(status)) {
      filter.status = status;
    } else {
      filter.status = "confirmed";
    }

    // Search filter: clientName OR queryId OR destination
    if (search) {
      filter.$or = [
        { clientName: { $regex: escapeRegex(search), $options: "i" } },
        { companyName: { $regex: escapeRegex(search), $options: "i" } },
        { queryId: { $regex: escapeRegex(search), $options: "i" } },
        { destination: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    // Date filter: match bookings created on the given date
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const bookings = await Booking.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        message: "Bookings fetched successfully",
        data: bookings,
      });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: bookings,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllBookings error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch bookings.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Booking by ID
// @route   GET /api/bookings/:id
// ─────────────────────────────────────────
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found", data: null });
    }
    res
      .status(200)
      .json({
        success: true,
        message: "Booking fetched successfully",
        data: booking,
      });
  } catch (error) {
    console.error("getBookingById error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch booking.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Booking by queryId (e.g. ASA2026100)
// @route   GET /api/bookings/by-query-id/:queryId
// ─────────────────────────────────────────
export const getBookingByQueryId = async (req, res) => {
  try {
    const queryId = (req.params.queryId || "").trim();
    if (!queryId) {
      return res.status(400).json({ success: false, message: "Booking ID is required", data: null });
    }
    const booking = await Booking.findOne({ queryId: { $regex: `^${escapeRegex(queryId)}$`, $options: "i" } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found", data: null });
    }
    res.status(200).json({ success: true, message: "Booking fetched successfully", data: booking });
  } catch (error) {
    console.error("getBookingByQueryId error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Booking by ID (full update from edit modal)
// @route   PUT /api/bookings/:id
// ─────────────────────────────────────────
export const updateBooking = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "No data provided to update",
          data: null,
        });
    }

    // Prevent queryId from being changed
    delete req.body.queryId;

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = [
      "customerId", "clientName", "companyName", "email", "mobile", "address",
      "destination", "pickupPoint", "dropPoint",
      "arrivalDate", "departureDate", "noOfDays",
      "adults", "childEB", "childNoEB", "childU5",
      "rooms", "hotelCategory", "mealPlan", "status",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.customerId === "") updates.customerId = null;

    // Prevent re-confirming a cancelled booking via full update
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found", data: null });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    );

    res
      .status(200)
      .json({
        success: true,
        message: "Booking updated successfully",
        data: booking,
      });
  } catch (error) {
    console.error("updateBooking error:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update booking.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Booking Status only
//          Business rule: confirmed → cancelled only, not reversible
// @route   PATCH /api/bookings/:id/status
// ─────────────────────────────────────────
export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["confirmed", "cancelled"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value", data: null });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found", data: null });
    }

    // ── Status ──────────────────────────────────

    booking.status = status;
    await booking.save();

    res
      .status(200)
      .json({
        success: true,
        message: `Booking status updated to ${status}`,
        data: booking,
      });
  } catch (error) {
    console.error("updateBookingStatus error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update booking status.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Save Itinerary for a Booking
// @route   PATCH /api/bookings/:id/itinerary
// ─────────────────────────────────────────
export const saveItinerary = async (req, res) => {
  try {
    const { itinerary, itineraryIncludes, itineraryExcludes } = req.body;

    if (!Array.isArray(itinerary)) {
      return res.status(400).json({
        success: false,
        message: "Itinerary must be an array",
        data: null,
      });
    }

    const update = { itinerary };
    if (itineraryIncludes !== undefined) update.itineraryIncludes = String(itineraryIncludes || "").trim();
    if (itineraryExcludes !== undefined) update.itineraryExcludes = String(itineraryExcludes || "").trim();

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: "after", runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Itinerary saved successfully",
      data: booking,
    });
  } catch (error) {
    console.error("saveItinerary error:", error);
    res.status(500).json({ success: false, message: "Failed to save itinerary.", data: null });
  }
};
