import express from "express";
import {
  getCounters,
  getCounterById,
  createCounter,
  updateCounter,
  deleteCounter,
  assignServicesToCounter,
  getAvailableCounters
} from "../controllers/counter.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateToken, getCounters);
router.get("/available", authenticateToken, getAvailableCounters);
router.get("/:id", authenticateToken, getCounterById);
router.post("/", authenticateToken, authorize("Admin"), createCounter);
router.put("/:id", authenticateToken, authorize("Admin"), updateCounter);
router.delete("/:id", authenticateToken, authorize("Admin"), deleteCounter);
router.post("/:counterId/services", authenticateToken, authorize("Admin"), assignServicesToCounter);

export default router;