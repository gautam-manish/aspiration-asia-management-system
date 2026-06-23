import express from "express";
import {
  createReservation,
  getAllReservations,
  getReservationById,
  updateReservation,
  sendReservationEmail,
} from "../controllers/reservation.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/reservations
// ─────────────────────────────────────────
router.route("/").get(getAllReservations).post(createReservation);
router.post("/:id/send-email", sendReservationEmail);
router.route("/:id").get(getReservationById).put(updateReservation);

export default router;
