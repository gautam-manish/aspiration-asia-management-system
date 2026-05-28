import express from "express";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoice.controller.js";

const router = express.Router();

router.route("/").get(getAllInvoices).post(createInvoice);
router.route("/:id").get(getInvoiceById).put(updateInvoice).delete(deleteInvoice);

export default router;