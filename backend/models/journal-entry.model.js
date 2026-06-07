import mongoose from "mongoose";

const journalLineSchema = new mongoose.Schema(
  {
    accountCode: { type: String, trim: true, required: true, index: true },
    accountName: { type: String, trim: true, required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    partyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    partyName: { type: String, trim: true, default: "" },
    bookingId: { type: String, trim: true, default: "" },
    memo: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const journalEntrySchema = new mongoose.Schema(
  {
    entryNumber: { type: String, trim: true, unique: true, index: true },
    entryDate: { type: String, trim: true, required: true, index: true },
    sourceEntity: { type: String, trim: true, required: true, index: true },
    sourceId: { type: String, trim: true, required: true, index: true },
    sourceNumber: { type: String, trim: true, default: "", index: true },
    sourceAction: {
      type: String,
      enum: ["post", "reversal"],
      default: "post",
      index: true,
    },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted",
      index: true,
    },
    memo: { type: String, trim: true, default: "" },
    currency: { type: String, trim: true, default: "Rs." },
    lines: {
      type: [journalLineSchema],
      validate: [(arr) => arr.length >= 2, "Journal entry must have at least two lines"],
    },
    totals: {
      debit: { type: Number, default: 0 },
      credit: { type: Number, default: 0 },
    },
    createdBy: {
      username: { type: String, trim: true, default: "" },
      role: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

journalEntrySchema.pre("validate", function validateBalancedJournal() {
  const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
  const cleanLines = (this.lines || []).filter((line) => round(line.debit) > 0 || round(line.credit) > 0);
  const totals = cleanLines.reduce((acc, line) => {
    acc.debit += round(line.debit);
    acc.credit += round(line.credit);
    line.debit = round(line.debit);
    line.credit = round(line.credit);
    return acc;
  }, { debit: 0, credit: 0 });

  this.lines = cleanLines;
  this.totals = {
    debit: round(totals.debit),
    credit: round(totals.credit),
  };

  if (this.lines.length >= 2 && this.totals.debit !== this.totals.credit) {
    this.invalidate("totals", "Journal entry debit and credit totals must balance");
  }
});

journalEntrySchema.index({ sourceEntity: 1, sourceId: 1, status: 1 });
journalEntrySchema.index({ entryDate: -1, createdAt: -1 });

export default mongoose.model("JournalEntry", journalEntrySchema);
