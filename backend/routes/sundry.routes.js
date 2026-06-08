import express from "express";
import {
  createSundry,
  getAllSundry,
  getNextSundryCode,
  getSundryById,
  getSundryDropdown,
  updateSundry,
} from "../controllers/sundry.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/sundry
// ─────────────────────────────────────────

// Must come before /:id to avoid "dropdown" being parsed as an id
router.route("/next-code").get(getNextSundryCode);
router.route("/dropdown").get(getSundryDropdown);

router.route("/").get(getAllSundry).post(createSundry);
router.route("/:id").get(getSundryById).put(updateSundry);

export default router;
