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
} from "../controllers/invoice.controller.js";

const router = express.Router();

router.route("/next-number").get(getNextInvoiceNumber);
router.route("/by-booking/:bookingId").get(getInvoiceByBookingId);
router.route("/by-number/:invoiceNumber").get(getInvoiceByNumber);
router.route("/").get(getAllInvoices).post(createInvoice);
router.route("/:id").get(getInvoiceById).put(updateInvoice).delete(deleteInvoice);

export default router;