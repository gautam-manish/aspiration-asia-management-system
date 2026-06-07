import express from "express";
import { backfillJournalEntries, getJournalEntries } from "../controllers/journal-entry.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.get("/", getJournalEntries);
router.post("/backfill", allowAdmin, backfillJournalEntries);

export default router;
