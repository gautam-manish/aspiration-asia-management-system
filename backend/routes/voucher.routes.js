import express from "express";
import {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  getVoucherByBookingId,
  updateVoucher,
} from "../controllers/voucher.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/vouchers
// ─────────────────────────────────────────
router.route("/by-booking/:bookingId").get(getVoucherByBookingId);
router.route("/").get(getAllVouchers).post(createVoucher);
router.route("/:id").get(getVoucherById).put(updateVoucher);

export default router;