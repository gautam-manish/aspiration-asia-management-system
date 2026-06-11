import express from "express";
import {
  createVendorBill,
  getAllVendorBills,
  getVendorBillById,
  updateVendorBill,
  uploadVendorTaxInvoiceSlip,
  voidVendorBill,
} from "../controllers/vendor-bill.controller.js";
import { uploadVendorTaxInvoiceSlip as uploadVendorTaxInvoiceMiddleware } from "../middleware/upload.middleware.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.post(
  "/upload-tax-invoice-slip",
  (req, res, next) => {
    uploadVendorTaxInvoiceMiddleware.single("slip")(req, res, (err) => {
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
  uploadVendorTaxInvoiceSlip,
);

router.route("/")
  .get(getAllVendorBills)
  .post(createVendorBill);

router.route("/:id")
  .get(getVendorBillById)
  .put(allowAdmin, updateVendorBill);

router.route("/:id/void")
  .patch(allowAdmin, voidVendorBill);

export default router;
