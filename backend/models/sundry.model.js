import mongoose from "mongoose";

// ─────────────────────────────────────────
//  Party / Sundry Debtors & Creditors Schema
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
    honorific: {
      type:    String,
      enum:    ["", "Mr.", "Mrs.", "Miss", "Dr"],
      default: "",
      trim:    true,
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
    phoneCountryCode: {
      type:    String,
      enum:    ["", "+977", "+91", "+975"],
      default: "+977",
      trim:    true,
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

    // ERP party-master fields. The legacy `type` field remains for existing
    // screens and reports; roles express how this party participates in ERP
    // workflows going forward.
    partyCode: {
      type:  String,
      trim:  true,
      sparse: true,
      unique: true,
    },
    roles: {
      type:    [String],
      enum:    ["customer", "vendor"],
      default: undefined,
    },
    status: {
      type:    String,
      enum:    ["active", "inactive"],
      default: "active",
    },
    openingBalance: {
      type:    Number,
      default: 0,
    },
    notes: {
      type:    String,
      trim:    true,
      default: "",
    },
  },
  { timestamps: true }
);

// Keep older debtor/creditor entries useful as ERP parties without requiring a
// one-time migration before the app can run.
sundrySchema.pre("validate", function () {
  if (!Array.isArray(this.roles) || this.roles.length === 0) {
    this.roles = this.type === "creditor" ? ["vendor"] : ["customer"];
  }
  const role = [...new Set(this.roles.filter(Boolean))][0] === "vendor" ? "vendor" : "customer";
  this.roles = [role];
  this.type = role === "vendor" ? "creditor" : "debtor";
});

sundrySchema.index({ contactPerson: 1 });
sundrySchema.index({ companyName: 1 });
sundrySchema.index({ roles: 1 });
sundrySchema.index({ status: 1 });

const Sundry = mongoose.model("Sundry", sundrySchema);
export default Sundry;
