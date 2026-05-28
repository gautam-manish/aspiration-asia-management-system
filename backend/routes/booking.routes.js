import express from "express";
import {
  getNextBookingId,
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingByQueryId,
  updateBooking,
  updateBookingStatus,
  saveItinerary,
} from "../controllers/booking.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/bookings
// ─────────────────────────────────────────
router.route("/next-id").get(getNextBookingId); // GET  /api/bookings/next-id
router.route("/by-query-id/:queryId").get(getBookingByQueryId); // GET  /api/bookings/by-query-id/ASA2026100
router.route("/").get(getAllBookings).post(createBooking); // GET  /api/bookings  |  POST /api/bookings
router.route("/:id").get(getBookingById).put(updateBooking); // GET  /api/bookings/:id  |  PUT /api/bookings/:id
router.route("/:id/status").patch(updateBookingStatus); // PATCH /api/bookings/:id/status
router.route("/:id/itinerary").patch(saveItinerary); // PATCH /api/bookings/:id/itinerary

export default router;
