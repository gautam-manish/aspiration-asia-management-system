import mongoose from "mongoose";

const vendorSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    pan: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const vendorBillLineSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["hotel", "transport", "guide", "activity", "flight", "visa", "meal", "other"],
      default: "other",
    },
    description: { type: String, trim: true, required: true },
    qty: { type: Number, default: 1, min: 0 },
    rate: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const vendorBillSchema = new mongoose.Schema(
  {
    billNumber: { type: String, trim: true, required: true, unique: true, index: true },
    vendorInvoiceNumber: { type: String, trim: true, default: "" },
    billDate: { type: String, trim: true, required: true },
    dueDate: { type: String, trim: true, default: "" },
    bookingId: { type: String, trim: true, default: "", index: true },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sundry",
      default: null,
      index: true,
    },
    vendor: { type: vendorSnapshotSchema, default: () => ({}) },
    lines: {
      type: [vendorBillLineSchema],
      validate: [(arr) => arr.length > 0, "At least one bill line is required"],
    },
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, default: "Rs." },
    status: {
      type: String,
      enum: ["open", "partial", "paid", "void"],
      default: "open",
      index: true,
    },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

vendorBillSchema.index({ billDate: -1, createdAt: -1 });
vendorBillSchema.index({ vendorInvoiceNumber: 1 });
vendorBillSchema.index({ "vendor.name": 1 });

export default mongoose.model("VendorBill", vendorBillSchema);
