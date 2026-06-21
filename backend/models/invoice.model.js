import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
      required: [true, "Line item description is required"],
    },
    details: { type: String, trim: true },
    qty: { type: Number, default: 1, min: [0, "Qty cannot be negative"] },
    rate: { type: Number, default: 0, min: [0, "Rate cannot be negative"] },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

// Advance payment recorded after the invoice was created.
// Each entry has an optional file slip stored on disk.
const advancePaymentSchema = new mongoose.Schema(
  {
    referenceCode: { type: String, trim: true, default: "" },
    amount:        { type: Number, default: 0, min: 0 },
    date:          { type: String, trim: true, default: "" },
    slip: {
      url:      { type: String, trim: true, default: "" },
      fileName: { type: String, trim: true, default: "" },
      mimeType: { type: String, trim: true, default: "" },
      size:     { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      trim: true,
      required: [true, "Invoice number is required"],
      unique: true,
      index: true,
    },
    invoiceDate: {
      type: String,
      trim: true,
      required: [true, "Invoice date is required"],
    },
    paymentTermsDays: {
      type: Number,
      default: 0,
      min: [0, "Payment terms cannot be negative"],
    },
    dueDate: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    bookingId: { type: String, trim: true, default: "" },
    clientName: { type: String, trim: true, default: "" },
    partyCompanyName: { type: String, trim: true, default: "" },
    partyContactPerson: { type: String, trim: true, default: "" },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sundry",
      default: null,
      index: true,
    },

    from: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      address1: { type: String, trim: true },
      address2: { type: String, trim: true },
      zip: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    billTo: {
      name: {
        type: String,
        trim: true,
        required: [true, "Bill To name is required"],
      },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      mobile: { type: String, trim: true },
    },

    lineItems: {
      type: [lineItemSchema],
      validate: [(arr) => arr.length > 0, "At least one line item is required"],
    },

    subtotal: { type: Number, default: 0 },
    discountType: { type: String, default: "none" },
    discountValue: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    // ── VAT / GST ──
    taxApplicable: { type: Boolean, default: false },
    taxPercent:    { type: Number,  default: 0 },   // %
    taxAmount:     { type: Number,  default: 0 },   // computed
    totalWithTax:  { type: Number,  default: 0 },   // subtotal - discount + taxAmount

    total: { type: Number, default: 0 },             // Final Total Due / Balance Due
    currency: { type: String, default: "₹" },
    currencyCode: { type: String, trim: true, uppercase: true, default: "INR" },
    exchangeRateToNpr: { type: Number, min: 0, default: 0 },
    exchangeRateDate: { type: String, trim: true, default: "" },
    exchangeRateSource: { type: String, trim: true, default: "" },
    exchangeRateType: {
      type: String,
      enum: ["", "base", "fixed", "buying"],
      default: "",
    },
    exchangeRateLockedAt: { type: Date, default: null },
    nprTotal: { type: Number, min: 0, default: 0 },

    // Advance payments captured after the invoice is issued.
    advancePayments: { type: [advancePaymentSchema], default: [] },

    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────────────
// invoiceNumber is already unique-indexed via the field declaration.
invoiceSchema.index({ "billTo.name": 1 });
invoiceSchema.index({ bookingId: 1 });
invoiceSchema.index({ createdAt: -1 });

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
