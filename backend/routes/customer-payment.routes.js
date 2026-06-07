import express from "express";
import {
  createCustomerPayment,
  getAllCustomerPayments,
  getCustomerPaymentById,
  updateCustomerPayment,
  voidCustomerPayment,
} from "../controllers/customer-payment.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/")
  .get(getAllCustomerPayments)
  .post(createCustomerPayment);

router.route("/:id")
  .get(getCustomerPaymentById)
  .put(allowAdmin, updateCustomerPayment);

router.route("/:id/void")
  .patch(allowAdmin, voidCustomerPayment);

export default router;
