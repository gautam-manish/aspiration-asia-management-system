import mongoose from "mongoose";

// ─────────────────────────────────────────
//  Manual Transaction Sub-Schema
//  Only credit (CR) entries are stored here.
//  Debit entries come from purchase records.
// ─────────────────────────────────────────
const bankTransactionSchema = new mongoose.Schema(
  {
    date: {
      type:    String, // "YYYY-MM-DD"
      trim:    true,
      default: "",
    },
    refNo: {
      type:    String,
      trim:    true,
      default: "",
    },
    description: {
      type:    String,
      trim:    true,
      default: "",
    },
    amount: {
      type:    Number,
      default: 0,
      min:     [0, "Transaction amount cannot be negative"],
    },
    type: {
      type:    String,
      enum:    ["cr"],
      default: "cr",
    },
  },
  { _id: true, timestamps: true }
);

// ─────────────────────────────────────────
//  Bank Account Schema
//  Collection: bankaccounts
// ─────────────────────────────────────────
const bankAccountSchema = new mongoose.Schema(
  {
    bankName: {
      type:     String,
      required: [true, "Bank name is required"],
      trim:     true,
    },
    branch: {
      type:    String,
      trim:    true,
      default: "",
    },
    accountName: {
      type:    String,
      trim:    true,
      default: "",
    },
    accountNumber: {
      type:    String,
      trim:    true,
      default: "",
    },
    // "swift" or "ifsc"
    codeType: {
      type:    String,
      enum:    ["swift", "ifsc"],
      default: "swift",
    },
    codeValue: {
      type:    String,
      trim:    true,
      default: "",
    },
    openingBalance: {
      type:    Number,
      default: 0,
    },

    // Only manual credit entries are stored here.
    // Debit entries are fetched from purchase records at query time.
    transactions: {
      type:    [bankTransactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

bankAccountSchema.index({ bankName: 1 });

const BankAccount = mongoose.model("BankAccount", bankAccountSchema);

export default BankAccount;
