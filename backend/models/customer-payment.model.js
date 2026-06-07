import mongoose from "mongoose";

const slipSchema = new mongoose.Schema(
  {
    url:      { type: String, trim: true, default: "" },
    fileName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size:     { type: Number, default: 0 },
  },
  { _id: false },
);

const customerSnapshotSchema = new mongoose.Schema(
  {
    name:    { type: String, trim: true, default: "" },
    email:   { type: String, trim: true, lowercase: true, default: "" },
    phone:   { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const customerPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sundry",
      default: null,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },
    bookingId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    customer: {
      type: customerSnapshotSchema,
      default: () => ({}),
    },
    paymentDate: {
      type: String,
      trim: true,
      required: [true, "Payment date is required"],
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be greater than zero"],
    },
    method: {
      type: String,
      enum: ["cash", "bank", "card", "wallet", "cheque", "other"],
      default: "bank",
    },
    referenceCode: {
      type: String,
      trim: true,
      default: "",
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankAccount",
      default: null,
    },
    slip: {
      type: slipSchema,
      default: () => ({}),
    },
    source: {
      type: String,
      enum: ["manual", "invoice-advance", "sales-record", "cash-receipt"],
      default: "manual",
      index: true,
    },
    sourceRef: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: ["posted", "void"],
      default: "posted",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

customerPaymentSchema.index({ paymentDate: 1 });
customerPaymentSchema.index({ customerId: 1, paymentDate: -1 });
customerPaymentSchema.index({ invoiceId: 1, status: 1 });
customerPaymentSchema.index({ source: 1, sourceRef: 1 });

const CustomerPayment = mongoose.model("CustomerPayment", customerPaymentSchema);

export default CustomerPayment;
