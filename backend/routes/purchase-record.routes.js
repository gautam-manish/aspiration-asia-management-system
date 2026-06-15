import express from "express";
import {
  getAllPurchaseRecords,
  getPurchaseRecordById,
  getPurchaseRecordByDebtor,
  createOrAddToPurchaseRecord,
  addTransaction,
  updatePurchaseRecord,
  deletePurchaseRecord,
  uploadPurchaseRecordAttachment,
  generateLedgerPdf,
} from "../controllers/purchase-record.controller.js";
import { uploadPurchaseRecordAttachment as uploadPurchaseRecordAttachmentMiddleware } from "../middleware/upload.middleware.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/purchaserecords
// ─────────────────────────────────────────

router.route("/by-debtor/:debtorName")
  .get(getPurchaseRecordByDebtor); // GET /api/purchaserecords/by-debtor/:name

router.post(
  "/upload-attachment",
  (req, res, next) => {
    uploadPurchaseRecordAttachmentMiddleware.single("slip")(req, res, (err) => {
      if (!err) return next();
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE" ? "File is too large. Maximum size is 1 MB." : err.message,
        data: null,
      });
    });
  },
  uploadPurchaseRecordAttachment,
);

router.route("/")
  .get(getAllPurchaseRecords)       // GET  /api/purchaserecords?search=abc
  .post(createOrAddToPurchaseRecord); // POST /api/purchaserecords

router.route("/:id")
  .get(getPurchaseRecordById)       // GET    /api/purchaserecords/:id
  .put(updatePurchaseRecord)        // PUT    /api/purchaserecords/:id
  .delete(deletePurchaseRecord);    // DELETE /api/purchaserecords/:id

// Add a new transaction entry to an existing debtor ledger
router.route("/:id/transaction")
  .post(addTransaction);            // POST /api/purchaserecords/:id/transaction

// PDF generation — streams PDF file
// Optional query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.route("/:id/pdf")
  .get(generateLedgerPdf);          // GET /api/purchaserecords/:id/pdf

export default router;


// ─────────────────────────────────────────
//  Mount in app.js / server.js:
//
//  import purchaseRecordRoutes from "./Routes/purchaserecordRoutes.js";
//  app.use("/api/purchaserecords", purchaseRecordRoutes);
//
// ─────────────────────────────────────────
//
//  ROUTE TABLE
//  ──────────────────────────────────────────────────────────────────────────
//  GET    /api/purchaserecords              getAllPurchaseRecords
//  POST   /api/purchaserecords              createOrAddToPurchaseRecord
//  GET    /api/purchaserecords/:id          getPurchaseRecordById
//  PUT    /api/purchaserecords/:id          updatePurchaseRecord (info only)
//  DELETE /api/purchaserecords/:id          deletePurchaseRecord
//  POST   /api/purchaserecords/:id/transaction  addTransaction
//  GET    /api/purchaserecords/:id/pdf      generateLedgerPdf
//  ──────────────────────────────────────────────────────────────────────────
//
//  PDF DEPENDENCY — install on your server:
//  pip3 install reportlab
//  (python3 must be available in PATH on the server)
//
// ─────────────────────────────────────────
