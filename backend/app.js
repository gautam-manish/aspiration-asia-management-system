import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import validateEnv from "./config/env.js";
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
import bankAccountRoutes    from "./routes/bank-account.routes.js";
import customerPaymentRoutes from "./routes/customer-payment.routes.js";
import vendorBillRoutes     from "./routes/vendor-bill.routes.js";
import vendorPaymentRoutes  from "./routes/vendor-payment.routes.js";
import officeExpenseRoutes  from "./routes/office-expense.routes.js";
import journalEntryRoutes   from "./routes/journal-entry.routes.js";
import reportRoutes         from "./routes/report.routes.js";
import auditLogRoutes       from "./routes/audit-log.routes.js";
import { auditAction }      from "./middleware/audit.middleware.js";
import { allowAdmin, allowFinance, allowSalesFinance, allowSalesOps } from "./middleware/rbac.middleware.js";

validateEnv();
connectDB();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Trust proxy (needed behind Nginx / Cloudflare so rate-limiter uses real IP)
app.set("trust proxy", 1);

// ── Security headers ─────────────────────────────────────────────────────────
// CSP is off so React inline styles still work. If you serve the React build
// via Nginx, you can enable CSP there instead.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

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
const legacyUploadBase = path.join(__dirname, "uploads");
if (path.resolve(legacyUploadBase) !== path.resolve(UPLOAD_BASE)) {
  app.use("/uploads", express.static(legacyUploadBase));
}

// ── Health check (used by load balancers / uptime monitors) ──────────────────
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// ── Global API rate limiter ──────────────────────────────────────────────────
// 100 requests per minute per IP — generous for normal use, blocks abuse.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});
app.use("/api", globalLimiter);

// ── Login brute-force protection ─────────────────────────────────────────────
// 20 attempts per 10 minutes per IP.
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

// ── Protected ────────────────────────────────────────────────────────────────
app.use("/api/sundry",          authMiddleware, allowSalesFinance, sundryRoutes);

app.use("/api/hotels",          authMiddleware, allowSalesOps, hotelRoutes);
app.use("/api/mail",            authMiddleware, allowSalesOps, emailRoutes);
app.use("/api/reservations",    authMiddleware, allowSalesOps, reservationRoutes);
app.use("/api/vouchers",        authMiddleware, allowSalesOps, auditAction("write", "voucher"), voucherRoutes);
app.use("/api/invoices",        authMiddleware, allowSalesFinance, auditAction("write", "invoice"), invoiceRoutes);
app.use("/api/cash-receipts",   authMiddleware, allowFinance, auditAction("write", "cash-receipt"), cashReceiptRoutes);
app.use("/api/calculator",      authMiddleware, allowSalesOps, calculatorRoutes);
app.use("/api/bookings",        authMiddleware, allowSalesOps, auditAction("write", "booking"), bookingRoutes);
app.use("/api/salesrecords",    authMiddleware, allowFinance, auditAction("write", "sales-record"), salesRecordRoutes);
app.use("/api/purchaserecords", authMiddleware, allowFinance, auditAction("write", "purchase-record"), purchaseRecordRoutes);
app.use("/api/bank-accounts",   authMiddleware, allowFinance, auditAction("write", "bank-account"), bankAccountRoutes);
app.use("/api/customer-payments", authMiddleware, allowFinance, auditAction("write", "customer-payment"), customerPaymentRoutes);
app.use("/api/vendor-bills",    authMiddleware, allowFinance, auditAction("write", "vendor-bill"), vendorBillRoutes);
app.use("/api/vendor-payments", authMiddleware, allowFinance, auditAction("write", "vendor-payment"), vendorPaymentRoutes);
app.use("/api/office-expenses", authMiddleware, allowFinance, auditAction("write", "office-expense"), officeExpenseRoutes);
app.use("/api/journal-entries", authMiddleware, allowFinance, journalEntryRoutes);
app.use("/api/reports",         authMiddleware, allowFinance, reportRoutes);
app.use("/api/audit-logs",      authMiddleware, allowFinance, auditLogRoutes);

// ── Centralized Error Handler ────────────────────────────────────────────────
// MUST be after all routes. Catches unhandled errors, multer errors, bad JSON,
// etc. In production, never expose internal error details to the client.
app.use((err, _req, res, _next) => {
  // Multer file-size / file-type errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File is too large (max 1 MB)." });
  }
  if (err.message?.includes("Only PDF, JPG, or JPEG")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error("[unhandled]", err);
  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again."
      : err.message || "Internal server error";
  res.status(status).json({ success: false, message });
});

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

// ── Catch-all: unhandled promise rejections & uncaught exceptions ────────────
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  // Let the process restart via pm2 / systemd
  process.exit(1);
});
