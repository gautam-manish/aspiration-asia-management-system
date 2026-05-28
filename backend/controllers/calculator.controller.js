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
    res
      .status(400)
      .json({ success: false, message: error.message, data: null });
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
    res
      .status(500)
      .json({ success: false, message: error.message, data: null });
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
    res
      .status(500)
      .json({ success: false, message: error.message, data: null });
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
    const record = await Calculator.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
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
    res
      .status(400)
      .json({ success: false, message: error.message, data: null });
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
    res
      .status(500)
      .json({ success: false, message: error.message, data: null });
  }
};
