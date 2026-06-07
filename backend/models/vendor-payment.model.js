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

const vendorSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const vendorPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, trim: true, required: true, unique: true, index: true },
    vendorBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorBill",
      default: null,
      index: true,
    },
    billNumber: { type: String, trim: true, uppercase: true, default: "", index: true },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sundry",
      default: null,
      index: true,
    },
    bookingId: { type: String, trim: true, default: "", index: true },
    vendor: { type: vendorSnapshotSchema, default: () => ({}) },
    paymentDate: { type: String, trim: true, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["cash", "bank", "card", "wallet", "cheque", "other"],
      default: "bank",
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

vendorPaymentSchema.index({ vendorId: 1, paymentDate: -1 });
vendorPaymentSchema.index({ vendorBillId: 1, status: 1 });

export default mongoose.model("VendorPayment", vendorPaymentSchema);
