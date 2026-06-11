import Sundry from "../models/sundry.model.js";
import Counter from "../models/counter.model.js";
import Booking from "../models/booking.model.js";
import escapeRegex from "../utils/escapeRegex.js";

const COUNTRIES = ["Nepal", "India", "Bhutan", ""];
const TYPES = ["debtor", "creditor"];
const ROLES = ["customer", "vendor"];
const STATUSES = ["active", "inactive"];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const normalisePhone = (v) => String(v || "").replace(/[\s\-()]/g, "");
const phoneOk = (v) => {
  const s = normalisePhone(v).replace(/^\+/, "");
  return /^\d{7,15}$/.test(s);
};
const panOk = (v) => /^[A-Za-z0-9]{5,20}$/.test(String(v || "").trim());

function validateSundryPayload(body = {}) {
  const requestedRoles = Array.isArray(body.roles)
    ? body.roles
    : (body.role ? [body.role] : []);
  let roles = [...new Set(
    requestedRoles
      .map((r) => String(r || "").trim().toLowerCase())
      .filter(Boolean),
  )];
  if (roles.length > 1) roles = [roles[0]];

  const data = {
    companyName: String(body.companyName || "").trim(),
    contactPerson: String(body.contactPerson || "").trim(),
    panVatGst: String(body.panVatGst || "").trim(),
    address: String(body.address || "").trim(),
    phone: String(body.phone || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    country: String(body.country || "").trim(),
    type: String(body.type || "").trim().toLowerCase(),
    partyCode: String(body.partyCode || "").trim().toUpperCase() || undefined,
    roles,
    status: String(body.status || "active").trim().toLowerCase(),
    openingBalance: Number(body.openingBalance) || 0,
    notes: String(body.notes || "").trim(),
  };

  if (!data.type) {
    data.type = data.roles.includes("vendor") && !data.roles.includes("customer")
      ? "creditor"
      : "debtor";
  }
  if (data.roles.length === 0) {
    data.roles = data.type === "creditor" ? ["vendor"] : ["customer"];
  }
  data.roles = data.roles[0] === "vendor" ? ["vendor"] : ["customer"];
  data.type = data.roles[0] === "vendor" ? "creditor" : "debtor";

  const errors = [];
  if (!data.contactPerson) errors.push("Contact person is required");
  else if (data.contactPerson.length < 2) errors.push("Contact person must be at least 2 characters");
  else if (data.contactPerson.length > 100) errors.push("Contact person is too long");

  if (data.companyName.length > 150) errors.push("Company name is too long");
  if (data.address.length > 250) errors.push("Address is too long");
  if (data.notes.length > 500) errors.push("Notes are too long");

  if (!TYPES.includes(data.type)) errors.push("Type must be 'debtor' or 'creditor'");
  if (!COUNTRIES.includes(data.country)) errors.push("Country must be Nepal, India, Bhutan, or empty");
  if (!STATUSES.includes(data.status)) errors.push("Status must be active or inactive");
  if (data.roles.length !== 1 || data.roles.some((r) => !ROLES.includes(r))) errors.push("Role must be customer or vendor");
  if (data.openingBalance < 0) errors.push("Opening balance cannot be negative");
  if (data.email && !isEmail(data.email)) errors.push("Email is not a valid address");
  if (data.phone && !phoneOk(data.phone)) errors.push("Phone must be 7-15 digits (optionally starting with +)");
  if (data.panVatGst && !panOk(data.panVatGst)) errors.push("PAN/VAT/GST must be 5-20 alphanumeric characters");
  if (data.partyCode && !/^[A-Z0-9-]{3,30}$/.test(data.partyCode)) {
    errors.push("Party code must be 3-30 characters using letters, numbers, or hyphens");
  }

  return { errors, data };
}

async function generatePartyCode(role) {
  const prefix = role === "vendor" ? "VEN" : "CUS";
  for (let attempts = 0; attempts < 100; attempts += 1) {
    const counter = await Counter.findOneAndUpdate(
      { name: `sundry-${role}` },
      { $inc: { seq: 1 } },
      { returnDocument: "after", upsert: true },
    );
    const code = `${prefix}-${String(counter.seq).padStart(5, "0")}`;
    const exists = await Sundry.exists({ partyCode: code });
    if (!exists) return code;
  }
  throw new Error("Failed to generate party code");
}

async function previewPartyCode(role) {
  const prefix = role === "vendor" ? "VEN" : "CUS";
  const counter = await Counter.findOne({ name: `sundry-${role}` }).lean();
  let seq = Number(counter?.seq || 0) + 1;
  for (let attempts = 0; attempts < 100; attempts += 1) {
    const code = `${prefix}-${String(seq).padStart(5, "0")}`;
    const exists = await Sundry.exists({ partyCode: code });
    if (!exists) return code;
    seq += 1;
  }
  throw new Error("Failed to preview party code");
}

function buildDuplicateQuery(data, ignoreId = null) {
  const ors = [];

  if (data.partyCode) ors.push({ partyCode: data.partyCode });
  if (data.panVatGst) ors.push({ panVatGst: { $regex: `^${escapeRegex(data.panVatGst)}$`, $options: "i" } });
  if (data.email) ors.push({ email: data.email });
  if (data.phone) ors.push({ phone: data.phone });

  if (ors.length === 0 && data.contactPerson) {
    ors.push({
      type: data.type,
      contactPerson: { $regex: `^${escapeRegex(data.contactPerson)}$`, $options: "i" },
      companyName: { $regex: `^${escapeRegex(data.companyName || "")}$`, $options: "i" },
    });
  }

  if (ors.length === 0) return null;

  const query = { $or: ors };
  if (ignoreId) query._id = { $ne: ignoreId };
  return query;
}

function describeDuplicate(existing, data) {
  if (data.partyCode && existing.partyCode === data.partyCode) {
    return `An entry with party code "${existing.partyCode}" already exists (${existing.contactPerson || existing.companyName})`;
  }
  if (
    data.panVatGst &&
    existing.panVatGst &&
    String(existing.panVatGst).toLowerCase() === data.panVatGst.toLowerCase()
  ) {
    return `An entry with PAN/VAT/GST "${existing.panVatGst}" already exists (${existing.contactPerson || existing.companyName})`;
  }
  if (data.email && String(existing.email).toLowerCase() === data.email.toLowerCase()) {
    return `An entry with email "${existing.email}" already exists (${existing.contactPerson || existing.companyName})`;
  }
  if (data.phone && existing.phone === data.phone) {
    return `An entry with phone "${existing.phone}" already exists (${existing.contactPerson || existing.companyName})`;
  }
  return `A ${existing.type} with the same name "${existing.contactPerson}"${existing.companyName ? ` at "${existing.companyName}"` : ""} already exists`;
}

function addCondition(filter, condition) {
  if (!filter.$and) filter.$and = [];
  filter.$and.push(condition);
}

function roleCondition(role) {
  if (role === "customer") {
    return { $or: [{ roles: "customer" }, { roles: { $exists: false }, type: "debtor" }] };
  }
  if (role === "vendor") {
    return { $or: [{ roles: "vendor" }, { roles: { $exists: false }, type: "creditor" }] };
  }
  return null;
}

export const createSundry = async (req, res) => {
  try {
    const { errors, data } = validateSundryPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    data.partyCode = await generatePartyCode(data.roles[0]);

    const dupQuery = buildDuplicateQuery(data);
    if (dupQuery) {
      const existing = await Sundry.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({ success: false, message: describeDuplicate(existing, data), data: null });
      }
    }

    const entry = await Sundry.create(data);
    return res.status(201).json({ success: true, message: "Party entry created successfully", data: entry });
  } catch (error) {
    console.error("createSundry error:", error);
    return res.status(500).json({ success: false, message: "Failed to create party entry.", data: null });
  }
};

export const getNextSundryCode = async (req, res) => {
  try {
    const role = String(req.query.role || "customer").toLowerCase() === "vendor" ? "vendor" : "customer";
    const partyCode = await previewPartyCode(role);
    return res.status(200).json({
      success: true,
      message: "Next party code generated",
      data: { partyCode, role },
    });
  } catch (error) {
    console.error("getNextSundryCode error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate party code.", data: null });
  }
};

export const getAllSundry = async (req, res) => {
  try {
    const { search, page, limit, role, type, status } = req.query;
    const filter = {};

    const cleanRole = String(role || "").toLowerCase();
    const cleanType = String(type || "").toLowerCase();
    const cleanStatus = String(status || "").toLowerCase();

    if (ROLES.includes(cleanRole)) addCondition(filter, roleCondition(cleanRole));
    if (TYPES.includes(cleanType)) filter.type = cleanType;
    if (STATUSES.includes(cleanStatus)) {
      addCondition(filter, cleanStatus === "active"
        ? { $or: [{ status: "active" }, { status: { $exists: false } }] }
        : { status: cleanStatus });
    }

    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { companyName: { $regex: escaped, $options: "i" } },
        { contactPerson: { $regex: escaped, $options: "i" } },
        { partyCode: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
      ];
    }

    const wantsPagination = page !== undefined || limit !== undefined;

    if (!wantsPagination) {
      const entries = await Sundry.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, message: "Party entries fetched successfully", data: entries });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      Sundry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Sundry.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Party entries fetched successfully",
      data: entries,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAllSundry error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch party entries.", data: null });
  }
};

export const getSundryDropdown = async (req, res) => {
  try {
    const filter = {};
    const cleanType = String(req.query.type || "").toLowerCase();
    const cleanRole = String(req.query.role || "").toLowerCase();

    if (TYPES.includes(cleanType)) filter.type = cleanType;
    if (ROLES.includes(cleanRole)) addCondition(filter, roleCondition(cleanRole));
    addCondition(filter, { $or: [{ status: "active" }, { status: { $exists: false } }] });

    const entries = await Sundry.find(filter)
      .select("partyCode contactPerson companyName email phone address panVatGst country type roles openingBalance")
      .sort({ contactPerson: 1 })
      .lean();

    return res.status(200).json({ success: true, message: "Party dropdown fetched", data: entries });
  } catch (error) {
    console.error("getSundryDropdown error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch dropdown.", data: null });
  }
};

export const getSundryById = async (req, res) => {
  try {
    const entry = await Sundry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Party entry not found", data: null });
    }
    return res.status(200).json({ success: true, message: "Party entry fetched successfully", data: entry });
  } catch (error) {
    console.error("getSundryById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch party entry.", data: null });
  }
};

export const updateSundry = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "No data provided to update", data: null });
    }

    const existingEntry = await Sundry.findById(req.params.id).lean();
    if (!existingEntry) {
      return res.status(404).json({ success: false, message: "Party entry not found", data: null });
    }

    const { errors, data } = validateSundryPayload({ ...existingEntry, ...req.body });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }
    data.partyCode = existingEntry.partyCode || await generatePartyCode(data.roles[0]);

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
      { returnDocument: "after", runValidators: true },
    );

    if (entry?.roles?.[0] === "customer") {
      await Booking.updateMany(
        { customerId: entry._id },
        {
          $set: {
            companyName: entry.companyName || "",
            contactPerson: entry.contactPerson || "",
            email: entry.email || "",
            mobile: entry.phone || "",
            address: entry.address || "",
          },
        },
      );
    }

    return res.status(200).json({ success: true, message: "Party entry updated successfully", data: entry });
  } catch (error) {
    console.error("updateSundry error:", error);
    return res.status(400).json({ success: false, message: "Failed to update party entry.", data: null });
  }
};
