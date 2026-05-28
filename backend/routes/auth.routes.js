import express from "express";
import { login, verifyToken } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/auth
// ─────────────────────────────────────────
router.post("/login", login);
router.get("/verify", authMiddleware, verifyToken);

export default router;