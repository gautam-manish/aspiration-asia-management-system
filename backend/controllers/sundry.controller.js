import Sundry from "../models/sundry.model.js";
import escapeRegex from "../utils/escapeRegex.js";

// ─────────────────────────────────────────
// Helpers — field validation + duplicate check
// ─────────────────────────────────────────
const COUNTRIES = ["Nepal", "India", "Bhutan", ""];
const TYPES     = ["debtor", "creditor"];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// Allow + and digits with optional spaces/dashes; final stripped length 7-15
const normalisePhone = (v) => String(v || "").replace(/[\s\-()]/g, "");
const phoneOk = (v) => {
  const s = normalisePhone(v).replace(/^\+/, "");
  return /^\d{7,15}$/.test(s);
};
// PAN/VAT/GST is alphanumeric, 5–20 chars, case-insensitive
const panOk = (v) => /^[A-Za-z0-9]{5,20}$/.test(String(v || "").trim());

function validateSundryPayload(body) {
  const errors = [];
  const data = {
    companyName:   String(body.companyName   || "").trim(),
    contactPerson: String(body.contactPerson || "").trim(),
    panVatGst:     String(body.panVatGst     || "").trim(),
    address:       String(body.address       || "").trim(),
    phone:         String(body.phone         || "").trim(),
    email:         String(body.email         || "").trim().toLowerCase(),
    country:       String(body.country       || "").trim(),
    type:          String(body.type          || "").trim().toLowerCase(),
  };

  if (!data.contactPerson)                  errors.push("Contact person is required");
  else if (data.contactPerson.length < 2)   errors.push("Contact person must be at least 2 characters");
  else if (data.contactPerson.length > 100) errors.push("Contact person is too long");

  if (data.companyName.length > 150)        errors.push("Company name is too long");
  if (data.address.length > 250)            errors.push("Address is too long");

  if (!TYPES.includes(data.type))           errors.push("Type must be 'debtor' or 'creditor'");
  if (!COUNTRIES.includes(data.country))    errors.push("Country must be Nepal, India, Bhutan, or empty");

  if (data.email && !isEmail(data.email))   errors.push("Email is not a valid address");
  if (data.phone && !phoneOk(data.phone))   errors.push("Phone must be 7–15 digits (optionally starting with +)");
  if (data.panVatGst && !panOk(data.panVatGst))
    errors.push("PAN/VAT/GST must be 5–20 alphanumeric characters");

  return { errors, data };
}

// Build a duplicate-detection query.
// Returns { query, reason } or null if no useful identifiers were provided.
function buildDuplicateQuery(data, ignoreId = null) {
  const ors = [];

  // Strongest: PAN/VAT/GST is a legal identifier — must be globally unique
  if (data.panVatGst) {
    ors.push({ panVatGst: { $regex: `^${escapeRx(data.panVatGst)}$`, $options: "i" } });
  }
  // Email — case-insensitive
  if (data.email) {
    ors.push({ email: data.email });
  }
  // Phone — strip formatting and compare against the stored one stripped too is hard
  // without a stored normalized field. Instead match exact normalised form.
  if (data.phone) {
    ors.push({ phone: data.phone });
  }

  // Fallback: same (type + contactPerson + companyName), case-insensitive
  if (ors.length === 0 && data.contactPerson) {
    ors.push({
      type: data.type,
      contactPerson: { $regex: `^${escapeRx(data.contactPerson)}$`, $options: "i" },
      companyName:   { $regex: `^${escapeRx(data.companyName || "")}$`, $options: "i" },
    });
  }

  if (ors.length === 0) return null;

  const query = { $or: ors };
  if (ignoreId) query._id = { $ne: ignoreId };
  return query;
}

// Use shared escapeRegex from utils (the local copy is replaced)
function escapeRx(v) {
  return escapeRegex(v);
}

// Friendly message describing which field collided
function describeDuplicate(existing, data) {
  if (data.panVatGst && existing.panVatGst &&
      String(existing.panVatGst).toLowerCase() === data.panVatGst.toLowerCase())
    return `An entry with PAN/VAT/GST "${existing.panVatGst}" already exists (${existing.contactPerson || existing.companyName})`;
  if (data.email && String(existing.email).toLowerCase() === data.email.toLowerCase())
    return `An entry with email "${existing.email}" already exists (${existing.contactPerson || existing.companyName})`;
  if (data.phone && existing.phone === data.phone)
    return `An entry with phone "${existing.phone}" already exists (${existing.contactPerson || existing.companyName})`;
  return `A ${existing.type} with the same name "${existing.contactPerson}"${existing.companyName ? ` at "${existing.companyName}"` : ""} already exists`;
}

// ─────────────────────────────────────────
// @desc    Create Sundry Entry
// @route   POST /api/sundry
// ─────────────────────────────────────────
export const createSundry = async (req, res) => {
  try {
    const { errors, data } = validateSundryPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    const dupQuery = buildDuplicateQuery(data);
    if (dupQuery) {
      const existing = await Sundry.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({ success: false, message: describeDuplicate(existing, data), data: null });
      }
    }

    const entry = await Sundry.create(data);
    res.status(201).json({ success: true, message: "Sundry entry created successfully", data: entry });
  } catch (error) {
    console.error("createSundry error:", error);
    res.status(500).json({ success: false, message: "Failed to create sundry entry.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sundry Entries
//          - GET /api/sundry?search=abc                  → ALL (back-compat)
//          - GET /api/sundry?search=&page=1&limit=50     → paginated envelope
// @route   GET /api/sundry?search=abc
// ─────────────────────────────────────────
export const getAllSundry = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { companyName:   { $regex: escapeRegex(search), $options: "i" } },
        { contactPerson: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const entries = await Sundry.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, message: "Sundry entries fetched successfully", data: entries });
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      Sundry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Sundry.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Sundry entries fetched successfully",
      data: entries,
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllSundry error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sundry entries.", data: null });
  }
};

// ─────────────────────────────────────────
// @desc    Get All Sundry for Dropdown
// @route   GET /api/sundry/dropdown
// ─────────────────────────────────────────
export const getSundryDropdown = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type && ["debtor", "creditor"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const entries = await Sundry.find(filter)
      .select("contactPerson companyName email phone address")
      .sort({ contactPerson: 1 })
      .lean();

    res.status(200).json({ success: true, message: "Sundry dropdown fetched", data: entries });
  } catch (error) {
    console.error("getSundryDropdown error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dropdown.", data: null });
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
    console.error("getSundryById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sundry entry.", data: null });
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

    const { errors, data } = validateSundryPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    const dupQuery = buildDuplicateQuery(data, req.params.id);
    if (dupQuery) {
      const existing = await Sundry.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({ success: false, message: describeDuplicate(existing, data), data: null });
      }
    }

    const entry = await Sundry.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    );

    if (!entry) {
      return res.status(404).json({ success: false, message: "Sundry entry not found", data: null });
    }

    res.status(200).json({ success: true, message: "Sundry entry updated successfully", data: entry });
  } catch (error) {
    console.error("updateSundry error:", error);
    res.status(400).json({ success: false, message: "Failed to update sundry entry.", data: null });
  }
};
