import express from "express";
import {
  createHotel,
  getAllHotels,
  getHotelById,
  updateHotel,
  deleteHotel,
} from "../controllers/hotel.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/hotels
// ─────────────────────────────────────────

router.route("/").get(getAllHotels).post(createHotel);

router.route("/:id").get(getHotelById).put(updateHotel).delete(deleteHotel);

export default router;