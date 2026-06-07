import express from "express";
import {
  createVendorPayment,
  getAllVendorPayments,
  getVendorPaymentById,
  updateVendorPayment,
  voidVendorPayment,
} from "../controllers/vendor-payment.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/")
  .get(getAllVendorPayments)
  .post(createVendorPayment);

router.route("/:id")
  .get(getVendorPaymentById)
  .put(allowAdmin, updateVendorPayment);

router.route("/:id/void")
  .patch(allowAdmin, voidVendorPayment);

export default router;
