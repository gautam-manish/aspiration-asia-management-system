import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url:      { type: String, trim: true, default: "" },
    fileName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size:     { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseLineSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true, default: "" },
    serviceType: { type: String, trim: true, default: "other" },
    description: { type: String, trim: true, default: "" },
    qty: { type: Number, default: 0, min: 0 },
    rate: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// ─────────────────────────────────────────
//  Transaction Sub-Schema
//  One entry per DR/CR row in the ledger
// ─────────────────────────────────────────
const transactionSchema = new mongoose.Schema(
  {
    date: {
      type:    String,   // "YYYY-MM-DD" from HTML date input
      trim:    true,
      default: "",
    },
    refNo: {
      type:    String,   // Voucher / Bill Number
      trim:    true,
      default: "",
    },
    bookingId: {
      type:    String,
      trim:    true,
      default: "",
    },
    clientName: {
      type:    String,   // Guest / Client name on bill
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
    bank: {
      type:    String,
      trim:    true,
      default: "",
    },
    type: {
      type:     String,
      enum:     ["dr", "cr"],
      required: [true, "Entry type (dr / cr) is required"],
      default:  "cr",
    },
    isOpening: {
      type:    Boolean,
      default: false,   // true only for the auto-generated opening balance entry
    },
    attachment: {
      type:    attachmentSchema,
      default: () => ({}),
    },
    lineItems: {
      type:    [purchaseLineSchema],
      default: [],
    },
    taxAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  { _id: true, timestamps: true }
);

// ─────────────────────────────────────────
//  Purchase Record Schema
//  One document per debtor
//  Collection: purchaserecords
// ─────────────────────────────────────────
const purchaseRecordSchema = new mongoose.Schema(
  {
    // ── Debtor info (copied from Sundry at time of creation) ──────────────
    debtorName: {
      type:     String,
      required: [true, "Debtor name is required"],
      trim:     true,
      unique:   true,    // one ledger per debtor
    },
    debtorCompany: {
      type:    String,
      trim:    true,
      default: "",
    },
    debtorPan: {
      type:    String,
      trim:    true,
      default: "",
    },
    debtorAddress: {
      type:    String,
      trim:    true,
      default: "",
    },
    debtorPhone: {
      type:    String,
      trim:    true,
      default: "",
    },
    debtorEmail: {
      type:      String,
      trim:      true,
      lowercase: true,
      default:   "",
    },
    vendorId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Sundry",
      default: null,
    },

    // ── Balances ──────────────────────────────────────────────────────────
    openingBalance: {
      type:    Number,
      default: 0,
      min:     [0, "Opening balance cannot be negative"],
    },
    totalDebit: {
      type:    Number,
      default: 0,
    },
    totalCredit: {
      type:    Number,
      default: 0,
    },
    closingBalance: {
      // Positive = DR (they owe us), Negative = CR (we owe them)
      type:    Number,
      default: 0,
    },

    // ── Fiscal year label (optional, e.g. "2082/2083") ────────────────────
    fiscalYear: {
      type:    String,
      trim:    true,
      default: "",
    },

    // ── Transactions ──────────────────────────────────────────────────────
    transactions: {
      type:    [transactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ── Pre-save: recalculate totals from transactions ───────────────────────────
purchaseRecordSchema.pre("save", function () {
  let dr = 0;
  let cr = 0;
  (this.transactions || []).forEach((t) => {
    if (t.type === "dr") dr += t.amount || 0;
    else                 cr += t.amount || 0;
  });
  this.totalDebit    = dr;
  this.totalCredit   = cr;
  // closingBalance: openingBalance (always DR) + all DR entries - all CR entries
  this.closingBalance = (this.openingBalance || 0) + dr - cr;
});

const PurchaseRecord = mongoose.model("PurchaseRecord", purchaseRecordSchema);

// ── Indexes ──────────────────────────────────────────────────────────────
// debtorName is already unique-indexed via the field declaration.
purchaseRecordSchema.index({ createdAt: -1 });
purchaseRecordSchema.index({ "transactions.bookingId": 1 });
purchaseRecordSchema.index({ vendorId: 1 });

export default PurchaseRecord;
