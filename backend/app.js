import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import connectDB from "./config/db.js";
import authMiddleware from "./middleware/auth.middleware.js";
import { UPLOAD_BASE } from "./middleware/upload.middleware.js";

import authRoutes           from "./routes/auth.routes.js";
import hotelRoutes          from "./routes/hotel.routes.js";
import emailRoutes          from "./routes/email.routes.js";
import reservationRoutes    from "./routes/reservation.routes.js";
import voucherRoutes        from "./routes/voucher.routes.js";
import invoiceRoutes        from "./routes/invoice.routes.js";
import cashReceiptRoutes    from "./routes/cash-receipt.routes.js";
import calculatorRoutes     from "./routes/calculator.routes.js";
import bookingRoutes        from "./routes/booking.routes.js";
import sundryRoutes         from "./routes/sundry.routes.js";
import salesRecordRoutes    from "./routes/sales-record.routes.js";
import purchaseRecordRoutes from "./routes/purchase-record.routes.js";

connectDB();

const app = express();

// ── Security headers (CSP off so React inline styles still work) ─────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── gzip compression on all responses ────────────────────────────────────────
app.use(compression());

// ── Request logging (skip in test) ───────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "tiny"));
}

// ── CORS ─────────────────────────────────────────────────────────────────────
// In dev: allow everything so Vite dev server can reach the API directly.
// In prod: allow only origins listed in CORS_ORIGIN (comma-separated) or any
// when the variable is unset.
const allowList = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin (curl, server-to-server) and Vite preview have no origin.
    if (!origin) return cb(null, true);
    if (allowList.length === 0) return cb(null, true);
    return cb(null, allowList.includes(origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// ── Static uploads ───────────────────────────────────────────────────────────
// Files are streamed from disk by the OS (low memory footprint).
// We serve from UPLOAD_BASE — same dir multer writes to, configurable via UPLOAD_DIR.
app.use("/uploads", express.static(UPLOAD_BASE));

// ── Health check (used by load balancers / uptime monitors) ──────────────────
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// ── Login brute-force protection ─────────────────────────────────────────────
// 15 attempts per 10 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in a few minutes.",
  },
});
app.use("/api/auth/login", loginLimiter);

// ── Public ───────────────────────────────────────────────────────────────────
app.use("/api/auth",   authRoutes);
app.use("/api/sundry", sundryRoutes);    // public for the dropdown lookup

// ── Protected ────────────────────────────────────────────────────────────────
app.use("/api/hotels",          authMiddleware, hotelRoutes);
app.use("/api/mail",            authMiddleware, emailRoutes);
app.use("/api/reservations",    authMiddleware, reservationRoutes);
app.use("/api/vouchers",        authMiddleware, voucherRoutes);
app.use("/api/invoices",        authMiddleware, invoiceRoutes);
app.use("/api/cash-receipts",   authMiddleware, cashReceiptRoutes);
app.use("/api/calculator",      authMiddleware, calculatorRoutes);
app.use("/api/bookings",        authMiddleware, bookingRoutes);
app.use("/api/salesrecords",    authMiddleware, salesRecordRoutes);
app.use("/api/purchaserecords", authMiddleware, purchaseRecordRoutes);

// ── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully…`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Force-exit after 10s if anything is hanging.
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
