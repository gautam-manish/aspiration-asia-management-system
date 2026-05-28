import express from "express";
import {
  createSalesRecord,
  getAllSalesRecords,
  getSalesRecordById,
  updateSalesRecord,
  deleteSalesRecord,
} from "../controllers/sales-record.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/salesrecords
// ─────────────────────────────────────────

router.route("/").get(getAllSalesRecords).post(createSalesRecord);

router
  .route("/:id")
  .get(getSalesRecordById)
  .put(updateSalesRecord)
  .delete(deleteSalesRecord);

export default router;


// ─────────────────────────────────────────
//  Mount in your app.js / server.js:
//
//  import salesRecordRoutes from "./Routes/salesrecordRoutes.js";
//  app.use("/api/salesrecords", salesRecordRoutes);
//
// ─────────────────────────────────────────
//
//  ROUTE TABLE
//  ─────────────────────────────────────────────────────────────────
//  GET    /api/salesrecords        getAllSalesRecords   List all records
//  POST   /api/salesrecords        createSalesRecord   Create new record
//  GET    /api/salesrecords/:id    getSalesRecordById  Get one record
//  PUT    /api/salesrecords/:id    updateSalesRecord   Update a record
//  DELETE /api/salesrecords/:id    deleteSalesRecord   Delete a record
//  ─────────────────────────────────────────────────────────────────
//  invoiceNumber is immutable after creation (PUT ignores it).
// ─────────────────────────────────────────────────────────────────