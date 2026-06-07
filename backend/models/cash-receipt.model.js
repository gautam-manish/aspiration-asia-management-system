import mongoose from "mongoose";

const cashReceiptSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    date: { type: String, trim: true },
    name: { type: String, required: [true, "Name is required"], trim: true },
    amount: { type: Number, required: [true, "Amount is required"] },
    amountInWords: { type: String, trim: true },
    cashChequeNo: { type: String, trim: true },
    bank: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true, uppercase: true, default: "" },
    bookingId: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "card", "wallet", "cheque", "other"],
      default: "cash",
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },
    paymentType: { type: String, trim: true },
  },
  { timestamps: true },
);

cashReceiptSchema.index({ name: 1 });
cashReceiptSchema.index({ invoiceNumber: 1 });
cashReceiptSchema.index({ createdAt: -1 });

const CashReceipt = mongoose.model("CashReceipt", cashReceiptSchema);

export default CashReceipt;
