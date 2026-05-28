import mongoose from "mongoose";

const cashReceiptSchema = new mongoose.Schema(
    {
        registrationNumber: {
            type: String, unique: true, trim: true
        },
        date: { type: String, trim: true },
        name: { type: String, required: [true, "Name is required"], trim: true },
        amount: { type: Number, required: [true, "Amount is required"] },
        amountInWords: { type: String, trim: true },
        cashChequeNo: { type: String, trim: true },
        bank: { type: String, trim: true },
        // paymentType: { type: String, enum: ["Guest Ledger", "City Ledger", "Other"], default: "Guest Ledger" },
        paymentType: { type: String, trim: true },
    },
    { timestamps: true }
);

const CashReceipt = mongoose.model("CashReceipt", cashReceiptSchema);
export default CashReceipt;