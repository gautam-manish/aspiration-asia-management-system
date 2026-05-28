import express from "express";
import {
  createCashReceipt,
  getAllCashReceipts,
  getCashReceiptById,
  deleteCashReceipt,
} from "../controllers/cash-receipt.controller.js";

const router = express.Router();

router.route("/").get(getAllCashReceipts).post(createCashReceipt);
router.route("/:id").get(getCashReceiptById).delete(deleteCashReceipt);

export default router;