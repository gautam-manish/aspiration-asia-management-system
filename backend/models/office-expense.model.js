import mongoose from "mongoose";

const slipSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: "" },
    fileName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false },
);

const officeExpenseSchema = new mongoose.Schema(
  {
    expenseNumber: { type: String, trim: true, required: true, unique: true, index: true },
    expenseDate: { type: String, trim: true, required: true, index: true },
    category: {
      type: String,
      enum: [
        "rent",
        "salary",
        "utilities",
        "marketing",
        "office-supplies",
        "communication",
        "bank-charges",
        "maintenance",
        "tax",
        "other",
      ],
      default: "other",
      index: true,
    },
    paidTo: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "card", "wallet", "cheque", "other"],
      default: "cash",
    },
    referenceCode: { type: String, trim: true, default: "" },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },
    slip: { type: slipSchema, default: () => ({}) },
    status: { type: String, enum: ["posted", "void"], default: "posted", index: true },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

officeExpenseSchema.index({ expenseDate: -1, createdAt: -1 });
officeExpenseSchema.index({ paidTo: 1 });

export default mongoose.model("OfficeExpense", officeExpenseSchema);
