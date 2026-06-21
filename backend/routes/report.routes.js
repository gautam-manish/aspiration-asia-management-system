import express from "express";
import {
  getApAging,
  getArAging,
  getAccountingReconciliation,
  getBookingProfitability,
  getBookingStats,
  getCustomerLedger,
  getProfitLoss,
  getVendorLedger,
} from "../controllers/report.controller.js";

const router = express.Router();

router.get("/ar-aging", getArAging);
router.get("/ap-aging", getApAging);
router.get("/booking-profitability", getBookingProfitability);
router.get("/booking-stats", getBookingStats);
router.get("/customer-ledger", getCustomerLedger);
router.get("/vendor-ledger", getVendorLedger);
router.get("/profit-loss", getProfitLoss);
router.get("/accounting-reconciliation", getAccountingReconciliation);

export default router;
