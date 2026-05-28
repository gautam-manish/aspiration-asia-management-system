import "dotenv/config";
import express from "express";
import cors    from "cors";

import connectDB from "./config/db.js";
import authMiddleware from "./middleware/auth.middleware.js";

import authRoutes           from "./routes/auth.routes.js";
import hotelRoutes          from "./routes/hotel.routes.js";
import emailRoutes          from "./routes/email.routes.js";
import reservationRoutes    from "./routes/reservation.routes.js";
import voucherRoutes        from "./routes/voucher.routes.js";
import invoiceRoutes        from "./routes/invoice.routes.js";
import cashReceiptRoutes    from "./routes/cash-receipt.routes.js";
import calculatorRoutes     from "./routes/calculator.routes.js";
import clientRoutes         from "./routes/client.routes.js";
import bookingRoutes        from "./routes/booking.routes.js";
import sundryRoutes         from "./routes/sundry.routes.js";
import salesRecordRoutes    from "./routes/sales-record.routes.js";
import purchaseRecordRoutes from "./routes/purchase-record.routes.js";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ── Public ─────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/sundry",   sundryRoutes);   // also used without auth for dropdown

// ── Protected ──────────────────────────────────────────────────────
app.use("/api/hotels",           authMiddleware, hotelRoutes);
app.use("/api/mail",             authMiddleware, emailRoutes);
app.use("/api/reservations",     authMiddleware, reservationRoutes);
app.use("/api/vouchers",         authMiddleware, voucherRoutes);
app.use("/api/invoices",         authMiddleware, invoiceRoutes);
app.use("/api/cash-receipts",    authMiddleware, cashReceiptRoutes);
app.use("/api/calculator",       authMiddleware, calculatorRoutes);
app.use("/api/clients",          authMiddleware, clientRoutes);
app.use("/api/bookings",         authMiddleware, bookingRoutes);
app.use("/api/salesrecords",     authMiddleware, salesRecordRoutes);
app.use("/api/purchaserecords",  authMiddleware, purchaseRecordRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
