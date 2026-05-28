import mongoose from "mongoose";

// ── Allowance Client Entry ────────────────────
const allowanceItemSchema = new mongoose.Schema(
  {
    purpose: { type: String, trim: true },
    amount:  { type: Number, default: 0 },
  },
  { _id: false }
);

const allowanceClientSchema = new mongoose.Schema(
  {
    clientName: { type: String, trim: true },
    startDate:  { type: String, trim: true },
    endDate:    { type: String, trim: true },
    items:      [allowanceItemSchema],
    total:      { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Expense Item ──────────────────────────────
const expenseItemSchema = new mongoose.Schema(
  {
    purpose: { type: String, trim: true },
    amount:  { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Payment Item ──────────────────────────────
const paymentItemSchema = new mongoose.Schema(
  {
    referenceNumber: { type: String, trim: true },
    amount:          { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────
const calculatorSchema = new mongoose.Schema(
  {
    title:          { type: String, trim: true, default: "Allowance/Expense Calculator" },
    allowances:     [allowanceClientSchema],
    expenses:       [expenseItemSchema],
    payments:       [paymentItemSchema],
    totalAllowance: { type: Number, default: 0 },
    totalExpense:   { type: Number, default: 0 },
    totalPayment:   { type: Number, default: 0 },
    balance:        { type: Number, default: 0 }, // totalAllowance + totalExpense - totalPayment
  },
  { timestamps: true }
);

const Calculator = mongoose.model("Calculator", calculatorSchema);
export default Calculator;