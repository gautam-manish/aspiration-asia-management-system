import mongoose from "mongoose";

// ─────────────────────────────────────────
//  Payment Entry Sub-Schema
// ─────────────────────────────────────────
const paymentEntrySchema = new mongoose.Schema(
  {
    referenceCode: {
      type:    String,
      trim:    true,
      default: "",
    },
    amount: {
      type:    Number,
      default: 0,
      min:     [0, "Payment amount cannot be negative"],
    },
    date: {
      type:    String,   // "YYYY-MM-DD" from HTML date input
      trim:    true,
      default: "",
    },
    // ── Optional payment slip (PDF / JPG / JPEG) ──
    // We store metadata only; the actual file lives on disk under /uploads.
    slip: {
      url:      { type: String, trim: true, default: "" }, // e.g. /uploads/payment-slips/abc.pdf
      fileName: { type: String, trim: true, default: "" }, // original name from the user
      mimeType: { type: String, trim: true, default: "" },
      size:     { type: Number, default: 0 },              // bytes
    },
  },
  { _id: true }
);

// ─────────────────────────────────────────
//  Sales Record Schema
//  Collection: salesrecords
// ─────────────────────────────────────────
const salesRecordSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type:      String,
      required:  [true, "Invoice number is required"],
      unique:    true,
      trim:      true,
      uppercase: true,
    },
    bookingId: {
      type:    String,
      trim:    true,
      default: "",
      index:   true,
    },

    // ── Client / Agent ──────────────────────────
    clientName: {
      type:     String,
      required: [true, "Client name is required"],
      trim:     true,
    },
    address: {
      type:    String,
      trim:    true,
      default: "",
    },
    phone: {
      type:    String,
      trim:    true,
      default: "",
    },
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   "",
    },

    // ── Amounts ──────────────────────────────────
    totalAmount: {
      type:    Number,
      default: 0,
      min:     [0, "Total amount cannot be negative"],
    },
    receivedAmount: {
      type:    Number,
      default: 0,
      min:     [0, "Received amount cannot be negative"],
    },
    outstandingBalance: {
      type:    Number,
      default: 0,
    },

    // ── Payment Entries ──────────────────────────
    paymentEntries: {
      type:    [paymentEntrySchema],
      default: [],
    },
  },
  { timestamps: true }   // createdAt, updatedAt
);

// ── Pre-save: auto-calculate receivedAmount & outstandingBalance ─────────────
salesRecordSchema.pre("save", function () {
  if (this.paymentEntries?.length) {
    this.receivedAmount = this.paymentEntries.reduce((s, e) => s + (e.amount || 0), 0);
  }
  this.outstandingBalance = (this.totalAmount || 0) - (this.receivedAmount || 0);
});

const SalesRecord = mongoose.model("SalesRecord", salesRecordSchema);

// ── Indexes ──────────────────────────────────────────────────────────────
// invoiceNumber is already unique-indexed via the field declaration.
salesRecordSchema.index({ clientName: 1 });
salesRecordSchema.index({ createdAt: -1 });

export default SalesRecord;
