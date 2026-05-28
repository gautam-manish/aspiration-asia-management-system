import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
      required: [true, "Line item description is required"],
    },
    details: { type: String, trim: true },
    qty: { type: Number, default: 1, min: [1, "Qty must be at least 1"] },
    rate: { type: Number, default: 0, min: [0, "Rate cannot be negative"] },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      trim: true,
      required: [true, "Invoice number is required"],
    },
    invoiceDate: {
      type: String,
      trim: true,
      required: [true, "Invoice date is required"],
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
    advance: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "$" },

    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
  },
  { timestamps: true },
);

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
