import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientName: String,
  invoiceNumber: String,
  address: String,
  phone: String,
  email: String,
  totalAmount: Number,
  receivedAmount: Number,
  outstandingBalance: Number
}, { timestamps: true });

export default mongoose.model('Client', clientSchema);