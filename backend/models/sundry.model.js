import mongoose from "mongoose";

// ─────────────────────────────────────────
//  Sundry Debtors & Creditors Schema
//  Collection: sundries
// ─────────────────────────────────────────

const sundrySchema = new mongoose.Schema(
  {
    companyName: {
      type:  String,
      trim:  true,
      default: "",
    },
    contactPerson: {
      type:     String,
      required: [true, "Contact person is required"],
      trim:     true,
    },
    panVatGst: {
      type:  String,
      trim:  true,
      default: "",
    },
    address: {
      type:  String,
      trim:  true,
      default: "",
    },
    phone: {
      type:  String,
      trim:  true,
      default: "",
    },
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   "",
    },
    country: {
      type: String,
      enum: ["Nepal", "India", "Bhutan", ""],
      default: "",
    },
    type: {
      type:     String,
      required: [true, "Type (debtor / creditor) is required"],
      enum:     ["debtor", "creditor"],
      default:  "debtor",
    },
  },
  { timestamps: true }
);

const Sundry = mongoose.model("Sundry", sundrySchema);
export default Sundry;