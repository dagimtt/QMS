import express from "express";
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServiceWorkflow
} from "../controllers/service.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateToken, getServices);
router.get("/:id", authenticateToken, getServiceById);
router.get("/:id/workflow", authenticateToken, getServiceWorkflow);
router.post("/", authenticateToken, authorize("Admin"), createService);
router.put("/:id", authenticateToken, authorize("Admin"), updateService);
router.delete("/:id", authenticateToken, authorize("Admin"), deleteService);

export default router;