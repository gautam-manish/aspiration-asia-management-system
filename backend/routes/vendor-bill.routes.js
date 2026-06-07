import express from "express";
import {
  createVendorBill,
  getAllVendorBills,
  getVendorBillById,
  updateVendorBill,
  voidVendorBill,
} from "../controllers/vendor-bill.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/")
  .get(getAllVendorBills)
  .post(createVendorBill);

router.route("/:id")
  .get(getVendorBillById)
  .put(allowAdmin, updateVendorBill);

router.route("/:id/void")
  .patch(allowAdmin, voidVendorBill);

export default router;
