import express from "express";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoiceByBookingId,
  getInvoiceByNumber,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  uploadAdvanceSlip,
  addAdvancePayment,
  removeAdvancePayment,
} from "../controllers/invoice.controller.js";
import { uploadAdvanceSlip as uploadAdvanceMiddleware } from "../middleware/upload.middleware.js";
import { allowAdmin, allowFinance } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/next-number").get(getNextInvoiceNumber);
router.route("/by-booking/:bookingId").get(getInvoiceByBookingId);
router.route("/by-number/:invoiceNumber").get(getInvoiceByNumber);

// Advance-payment slip upload (1 MB cap, PDF/JPG/JPEG only).
// Wrap multer so size / type errors return a JSON 400/413 instead of an HTML page.
router.post(
  "/upload-advance-slip",
  (req, res, next) => {
    uploadAdvanceMiddleware.single("slip")(req, res, (err) => {
      if (err) {
        const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        const msg  = err.code === "LIMIT_FILE_SIZE"
          ? "File is too large (max 1 MB)"
          : err.message || "Upload failed";
        return res.status(code).json({ success: false, message: msg, data: null });
      }
      next();
    });
  },
  uploadAdvanceSlip,
);

router.route("/").get(getAllInvoices).post(createInvoice);
router.route("/:id").get(getInvoiceById).put(allowAdmin, updateInvoice).delete(allowAdmin, deleteInvoice);

// Advance payments on an existing invoice
router.route("/:id/advance").post(allowFinance, addAdvancePayment);
router.route("/:id/advance/:advanceId").delete(allowAdmin, removeAdvancePayment);

export default router;
