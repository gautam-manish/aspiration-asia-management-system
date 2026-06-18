import mongoose from "mongoose";

export const DEFAULT_COMPANY_SETTINGS = {
  key: "default",
  companyName: "Aspiration Asia Trekking & Expedition Pvt Ltd",
  addressLine: "Near Nyatapol Temple Bhaktapur, Nepal",
  phone: "+977 9746239349",
  email: "account@aspirationasia.com",
  panNumber: "610278626",
  registrationNumber: "290216/78/079",
  logoUrl: "https://i.ibb.co/bRJr7nNM/images.png",
  invoiceAccountName: "Aspiration Asia Trekking",
};

const companySettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["default"],
      default: "default",
      unique: true,
      index: true,
    },
    companyName: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.companyName },
    addressLine: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.addressLine },
    phone: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.phone },
    email: { type: String, trim: true, lowercase: true, default: DEFAULT_COMPANY_SETTINGS.email },
    panNumber: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.panNumber },
    registrationNumber: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.registrationNumber },
    logoUrl: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.logoUrl },
    invoiceAccountName: { type: String, trim: true, default: DEFAULT_COMPANY_SETTINGS.invoiceAccountName },
  },
  { timestamps: true },
);

const CompanySetting = mongoose.model("CompanySetting", companySettingSchema);
export default CompanySetting;
