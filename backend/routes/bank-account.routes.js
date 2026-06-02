import express from "express";
import {
  getAllBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  addBankTransaction,
  getBankDropdown,
} from "../controllers/bank-account.controller.js";

const router = express.Router();

// ─────────────────────────────────────────
// Base Route: /api/bank-accounts
// ─────────────────────────────────────────

// Must be before /:id to avoid being caught by the param route
router.route("/dropdown")
  .get(getBankDropdown);           // GET /api/bank-accounts/dropdown

router.route("/")
  .get(getAllBankAccounts)          // GET  /api/bank-accounts
  .post(createBankAccount);        // POST /api/bank-accounts

router.route("/:id")
  .get(getBankAccountById)         // GET    /api/bank-accounts/:id
  .put(updateBankAccount)          // PUT    /api/bank-accounts/:id
  .delete(deleteBankAccount);      // DELETE /api/bank-accounts/:id

router.route("/:id/transaction")
  .post(addBankTransaction);       // POST /api/bank-accounts/:id/transaction

export default router;
