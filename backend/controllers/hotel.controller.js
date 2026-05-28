import Hotel from "../models/hotel.model.js";

// ─────────────────────────────────────────
// @desc    Create a new Hotel
// @route   POST /api/hotels
// @access  Admin
// ─────────────────────────────────────────
export const createHotel = async (req, res) => {
  try {
    const { name, country, city, costPerRoom } = req.body;

    // ── Duplicate Check ──────────────────────────
    const existingHotel = await Hotel.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      city: { $regex: `^${city}$`, $options: "i" },
    });

    if (existingHotel) {
      return res.status(409).json({
        success: false,
        message: `Hotel "${name}" in ${city} already exists.`,
        data: null,
      });
    }
    // ─────────────────────────────────────────────

    const hotel = await Hotel.create({ name, country, city, costPerRoom });

    res.status(201).json({
      success: true,
      message: "Hotel created successfully",
      data: hotel,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

// ─────────────────────────────────────────
// @desc    Get all Hotels (with optional search by name)
// @route   GET /api/hotels?search=hilton
// @access  Admin
// ─────────────────────────────────────────
export const getAllHotels = async (req, res) => {
  try {
    const { search } = req.query;

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const hotels = await Hotel.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Hotels fetched successfully",
      data: hotels,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    res.status(500).json({
      success: false,
      message: error.message,
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
      name: { $regex: `^${name}$`, $options: "i" },
      city: { $regex: `^${city}$`, $options: "i" },
    });

    if (existingHotel) {
      return res.status(409).json({
        success: false,
        message: `Hotel "${name}" in ${city} already exists.`,
        data: null,
      });
    }
    // ─────────────────────────────────────────────

    const hotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
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
    res.status(400).json({
      success: false,
      message: error.message,
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
    res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};