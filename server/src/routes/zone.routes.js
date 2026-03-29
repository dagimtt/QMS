import express from "express";
import {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  getZoneStatistics
} from "../controllers/zone.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateToken, getZones);
router.get("/:id", authenticateToken, getZoneById);
router.get("/:id/statistics", authenticateToken, getZoneStatistics);
router.post("/", authenticateToken, authorize("Admin"), createZone);
router.put("/:id", authenticateToken, authorize("Admin"), updateZone);
router.delete("/:id", authenticateToken, authorize("Admin"), deleteZone);

export default router;