import Hotel from "../models/hotel.model.js";
import escapeRegex from "../utils/escapeRegex.js";

// ─────────────────────────────────────────
// @desc    Create a new Hotel
// @route   POST /api/hotels
// @access  Admin
// ─────────────────────────────────────────
export const createHotel = async (req, res) => {
  try {
    const { name, country, city, contactNumbers, googleMapUrl, costPerRoom } = req.body;

    // ── Duplicate Check ──────────────────────────
    const existingHotel = await Hotel.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      city: { $regex: `^${escapeRegex(city)}$`, $options: "i" },
    });

    if (existingHotel) {
      return res.status(409).json({
        success: false,
        message: `Hotel "${name}" in ${city} already exists.`,
        data: null,
      });
    }
    // ─────────────────────────────────────────────

    const hotel = await Hotel.create({ name, country, city, contactNumbers, googleMapUrl, costPerRoom });

    res.status(201).json({
      success: true,
      message: "Hotel created successfully",
      data: hotel,
    });
  } catch (error) {
    console.error("createHotel error:", error);
    res.status(400).json({
      success: false,
      message: "Failed to create hotel.",
      data: null,
    });
  }
};

// ─────────────────────────────────────────
// @desc    Get all Hotels.
//          - GET /api/hotels?search=hilton                  → returns ALL matching (back-compat)
//          - GET /api/hotels?search=hilton&page=1&limit=50  → paginated; envelope adds total/page/limit/totalPages
// @access  Admin
// ─────────────────────────────────────────
export const getAllHotels = async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const query = {};
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: "i" };
    }

    // Detect whether the client wants pagination. If neither page nor limit was
    // supplied, behave exactly as before (return the whole list) so callers
    // like the HotelSearchSelect autocomplete keep working unchanged.
    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const hotels = await Hotel.find(query).sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        message: "Hotels fetched successfully",
        data: hotels,
      });
    }

    // ── Paginated path ──────────────────────────
    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [hotels, total] = await Promise.all([
      Hotel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Hotel.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Hotels fetched successfully",
      data: hotels,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllHotels error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hotels.",
      data: null,
    });
  }
};

// ─────────────────────────────────────────
// @desc    Get a single Hotel by ID
// @route   GET /api/hotels/:id
// @access  Admin
// ─────────────────────────────────────────
export const getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Hotel fetched successfully",
      data: hotel,
    });
  } catch (error) {
    console.error("getHotelById error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hotel.",
      data: null,
    });
  }
};

// ─────────────────────────────────────────
// @desc    Update a Hotel by ID
// @route   PUT /api/hotels/:id
// @access  Admin
// ─────────────────────────────────────────
export const updateHotel = async (req, res) => {
  try {

    // ── Empty Body Check ─────────────────────────
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided to update.",
        data: null,
      });
    }
    // ─────────────────────────────────────────────

    const { name, city } = req.body;

    // ── Duplicate Check ──────────────────────────
    const existingHotel = await Hotel.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
      city: { $regex: `^${escapeRegex(city)}$`, $options: "i" },
    });

    if (existingHotel) {
      return res.status(409).json({
        success: false,
        message: `Hotel "${name}" in ${city} already exists.`,
        data: null,
      });
    }
    // ─────────────────────────────────────────────

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ["name", "country", "city", "contactNumbers", "googleMapUrl", "costPerRoom"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const hotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Hotel updated successfully",
      data: hotel,
    });
  } catch (error) {
    console.error("updateHotel error:", error);
    res.status(400).json({
      success: false,
      message: "Failed to update hotel.",
      data: null,
    });
  }
};

// ─────────────────────────────────────────
// @desc    Delete a Hotel by ID
// @route   DELETE /api/hotels/:id
// @access  Admin
// ─────────────────────────────────────────
export const deleteHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndDelete(req.params.id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Hotel deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("deleteHotel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete hotel.",
      data: null,
    });
  }
};