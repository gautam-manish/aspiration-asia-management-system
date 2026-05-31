import express from "express";
import {
  createSalesRecord,
  getAllSalesRecords,
  getSalesRecordById,
  getSalesRecordByInvoiceNumber,
  updateSalesRecord,
  deleteSalesRecord,
  uploadPaymentSlip,
  removePaymentSlip,
} from "../controllers/sales-record.controller.js";
import { uploadPaymentSlip as uploadMiddleware } from "../middleware/upload.middleware.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/salesrecords
// ─────────────────────────────────────────

router.route("/by-invoice/:invoiceNumber").get(getSalesRecordByInvoiceNumber);

// Upload route: wrap multer to convert validation errors into JSON 400s instead
// of bubbling up to the default Express HTML error page.
router.post(
  "/upload-slip",
  (req, res, next) => {
    uploadMiddleware.single("slip")(req, res, (err) => {
      if (err) {
        const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        const msg  = err.code === "LIMIT_FILE_SIZE"
          ? "File is too large (max 5 MB)"
          : err.message || "Upload failed";
        return res.status(code).json({ success: false, message: msg, data: null });
      }
      next();
    });
  },
  uploadPaymentSlip
);

router.route("/slip").delete(removePaymentSlip);
router.route("/").get(getAllSalesRecords).post(createSalesRecord);

router
  .route("/:id")
  .get(getSalesRecordById)
  .put(updateSalesRecord)
  .delete(deleteSalesRecord);

export default router;


// ─────────────────────────────────────────
//  Mount in your app.js / server.js:
//
//  import salesRecordRoutes from "./Routes/salesrecordRoutes.js";
//  app.use("/api/salesrecords", salesRecordRoutes);
//
// ─────────────────────────────────────────
//
//  ROUTE TABLE
//  ─────────────────────────────────────────────────────────────────
//  GET    /api/salesrecords        getAllSalesRecords   List all records
//  POST   /api/salesrecords        createSalesRecord   Create new record
//  GET    /api/salesrecords/:id    getSalesRecordById  Get one record
//  PUT    /api/salesrecords/:id    updateSalesRecord   Update a record
//  DELETE /api/salesrecords/:id    deleteSalesRecord   Delete a record
//  ─────────────────────────────────────────────────────────────────
//  invoiceNumber is immutable after creation (PUT ignores it).
// ─────────────────────────────────────────────────────────────────