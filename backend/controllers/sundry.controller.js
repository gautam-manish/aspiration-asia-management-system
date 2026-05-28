import Sundry from "../models/sundry.model.js";

// ─────────────────────────────────────────
// @desc    Create Sundry Entry
// @route   POST /api/sundry
// ─────────────────────────────────────────
export const createSundry = async (req, res) => {
  try {
    const {
      companyName, contactPerson, panVatGst,
      address, phone, email, country, type,
    } = req.body;

    if (!contactPerson) {
      return res.status(400).json({ success: false, message: "Contact person is required", data: null });
    }
    if (!type || !["debtor", "creditor"].includes(type)) {
      return res.status(400).json({ success: false, message: "Valid type (debtor / creditor) is required", data: null });
    }

    const entry = await Sundry.create({
      companyName:   companyName   || "",
      contactPerson,
      panVatGst:     panVatGst     || "",
      address:       address       || "",
      phone:         phone         || "",
      email:         email         || "",
      country:       country       || "",
      type,
    });

    res.status(201).json({ success: true, message: "Sundry entry created successfully", data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sundry Entries
//          Search: companyName or contactPerson
// @route   GET /api/sundry?search=abc
// ─────────────────────────────────────────
export const getAllSundry = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { companyName:   { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
      ];
    }

    const entries = await Sundry.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: "Sundry entries fetched successfully", data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sundry for Dropdown
//          Returns lean list: _id, contactPerson, companyName, email, phone, address
//          Used by query.html to populate the client/agent dropdown
// @route   GET /api/sundry/dropdown
// ─────────────────────────────────────────
export const getSundryDropdown = async (req, res) => {
  try {
    const filter = {};
    // Allow filtering by type (e.g. ?type=creditor)
    if (req.query.type && ["debtor", "creditor"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const entries = await Sundry.find(filter)
      .select("contactPerson companyName email phone address")
      .sort({ contactPerson: 1 })
      .lean();

    res.status(200).json({ success: true, message: "Sundry dropdown fetched", data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get Single Sundry Entry by ID
// @route   GET /api/sundry/:id
// ─────────────────────────────────────────
export const getSundryById = async (req, res) => {
  try {
    const entry = await Sundry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Sundry entry not found", data: null });
    }
    res.status(200).json({ success: true, message: "Sundry entry fetched successfully", data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Update Sundry Entry by ID
// @route   PUT /api/sundry/:id
// ─────────────────────────────────────────
export const updateSundry = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "No data provided to update", data: null });
    }

    const entry = await Sundry.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, message: "Sundry entry not found", data: null });
    }

    res.status(200).json({ success: true, message: "Sundry entry updated successfully", data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message, data: null });
  }
};