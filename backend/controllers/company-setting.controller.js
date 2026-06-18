import CompanySetting, { DEFAULT_COMPANY_SETTINGS } from "../models/company-setting.model.js";

const pickSettings = (body = {}) => ({
  companyName: String(body.companyName || "").trim(),
  addressLine: String(body.addressLine || "").trim(),
  phone: String(body.phone || "").trim(),
  email: String(body.email || "").trim().toLowerCase(),
  panNumber: String(body.panNumber || "").trim(),
  registrationNumber: String(body.registrationNumber || "").trim(),
  invoiceAccountName: String(body.invoiceAccountName || "").trim(),
});

const normaliseSettings = (settings) => ({
  ...DEFAULT_COMPANY_SETTINGS,
  ...(typeof settings?.toObject === "function" ? settings.toObject() : settings || {}),
});

export const getCompanySettings = async (_req, res) => {
  try {
    const settings = await CompanySetting.findOne({ key: "default" }).lean();
    return res.status(200).json({
      success: true,
      message: "Company settings fetched successfully",
      data: normaliseSettings(settings),
    });
  } catch (error) {
    console.error("getCompanySettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch company settings.", data: null });
  }
};

export const updateCompanySettings = async (req, res) => {
  try {
    const existing = await CompanySetting.findOne({ key: "default" }).lean();
    const data = pickSettings(req.body);
    const preserved = normaliseSettings(existing);
    const errors = [];

    if (!data.companyName) errors.push("Company name is required");
    if (!data.addressLine) errors.push("Address is required");
    if (!data.phone) errors.push("Phone is required");
    if (!data.email) errors.push("Email is required");
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Email is not valid");
    if (!data.panNumber) errors.push("PAN number is required");
    if (!data.registrationNumber) errors.push("Registration number is required");
    if (!data.invoiceAccountName) errors.push("Invoice account name is required");

    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(". "), data: null });
    }

    const settings = await CompanySetting.findOneAndUpdate(
      { key: "default" },
      { $set: { ...data, logoUrl: preserved.logoUrl, key: "default" } },
      { new: true, upsert: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Company settings updated successfully",
      data: normaliseSettings(settings),
    });
  } catch (error) {
    console.error("updateCompanySettings error:", error);
    return res.status(400).json({ success: false, message: "Failed to update company settings.", data: null });
  }
};
