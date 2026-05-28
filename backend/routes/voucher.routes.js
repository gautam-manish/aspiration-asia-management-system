import express from "express";
import {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
} from "../controllers/voucher.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/vouchers
// ─────────────────────────────────────────
router.route("/").get(getAllVouchers).post(createVoucher);
router.route("/:id").get(getVoucherById).put(updateVoucher);

export default router;