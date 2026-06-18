import express from "express";
import { getCompanySettings, updateCompanySettings } from "../controllers/company-setting.controller.js";
import { allowAdmin } from "../middleware/rbac.middleware.js";

const router = express.Router();

router.route("/")
  .get(getCompanySettings)
  .put(allowAdmin, updateCompanySettings);

export default router;
