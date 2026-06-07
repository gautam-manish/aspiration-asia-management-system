import express from "express";
import { getAuditLogs } from "../controllers/audit-log.controller.js";

const router = express.Router();

router.get("/", getAuditLogs);

export default router;
