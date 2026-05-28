import express from "express";
import { sendPackageMail, sendReservationMail } from "../controllers/email.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/mail
// ─────────────────────────────────────────
router.post("/send-mail", sendPackageMail);
router.post("/send-reservation", sendReservationMail);

export default router;