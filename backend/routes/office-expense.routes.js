import express from "express";
import {
  createOfficeExpense,
  getAllOfficeExpenses,
  getOfficeExpenseById,
  updateOfficeExpense,
  voidOfficeExpense,
} from "../controllers/office-expense.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/")
  .get(getAllOfficeExpenses)
  .post(createOfficeExpense);

router.route("/:id")
  .get(getOfficeExpenseById)
  .put(allowAdmin, updateOfficeExpense);

router.route("/:id/void")
  .patch(allowAdmin, voidOfficeExpense);

export default router;
