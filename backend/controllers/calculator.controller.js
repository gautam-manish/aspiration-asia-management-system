import Calculator from "../models/calculator.model.js";

// ─────────────────────────────────────────
// @desc    Create Calculator Record
// @route   POST /api/calculator
// ─────────────────────────────────────────
export const createCalculator = async (req, res) => {
  try {
    const record = await Calculator.create(req.body);
    res
      .status(201)
      .json({
        success: true,
        message: "Record saved successfully",
        data: record,
      });
  } catch (error) {
    console.error("createCalculator error:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to create record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Calculator Records
// @route   GET /api/calculator
// ─────────────────────────────────────────
export const getAllCalculators = async (req, res) => {
  try {
    const records = await Calculator.find().sort({ createdAt: -1 });
    res
      .status(200)
      .json({
        success: true,
        message: "Records fetched successfully",
        data: records,
      });
  } catch (error) {
    console.error("getAllCalculators error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch records.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Calculator Record
// @route   GET /api/calculator/:id
// ─────────────────────────────────────────
export const getCalculatorById = async (req, res) => {
  try {
    const record = await Calculator.findById(req.params.id);
    if (!record)
      return res
        .status(404)
        .json({ success: false, message: "Record not found", data: null });
    res
      .status(200)
      .json({
        success: true,
        message: "Record fetched successfully",
        data: record,
      });
  } catch (error) {
    console.error("getCalculatorById error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Calculator Record
// @route   PUT /api/calculator/:id
// ─────────────────────────────────────────
export const updateCalculator = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0)
      return res
        .status(400)
        .json({ success: false, message: "No data provided", data: null });

    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = [
      "agency", "clientDetails", "accommodation", "costs", "total",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const record = await Calculator.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    );
    if (!record)
      return res
        .status(404)
        .json({ success: false, message: "Record not found", data: null });
    res
      .status(200)
      .json({
        success: true,
        message: "Record updated successfully",
        data: record,
      });
  } catch (error) {
    console.error("updateCalculator error:", error);
    res
      .status(400)
      .json({ success: false, message: "Failed to update record.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Delete Calculator Record
// @route   DELETE /api/calculator/:id
// ─────────────────────────────────────────
export const deleteCalculator = async (req, res) => {
  try {
    const record = await Calculator.findByIdAndDelete(req.params.id);
    if (!record)
      return res
        .status(404)
        .json({ success: false, message: "Record not found", data: null });
    res
      .status(200)
      .json({
        success: true,
        message: "Record deleted successfully",
        data: null,
      });
  } catch (error) {
    console.error("deleteCalculator error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete record.", data: null });
  }
};
