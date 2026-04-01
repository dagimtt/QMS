import express from "express";
import {
  getCounters,
  getCounterById,
  createCounter,
  updateCounter,
  deleteCounter,
  assignUserToCounter,
  removeUserFromCounter,
  getCountersByUser,
  assignServicesToCounter,
  getAvailableCounters,
  resetCounterStatus,
  resetAllCountersInZone
} from "../controllers/counter.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Public (authenticated) routes
router.get("/", getCounters);
router.get("/available", getAvailableCounters);
router.get("/user/:userId", getCountersByUser);
router.get("/:id", getCounterById);

// Admin only routes
router.post("/", authorize("Admin"), createCounter);
router.put("/:id", authorize("Admin"), updateCounter);
router.delete("/:id", authorize("Admin"), deleteCounter);
router.post("/:counterId/assign-user", authorize("Admin"), assignUserToCounter);
router.delete("/:counterId/remove-user", authorize("Admin"), removeUserFromCounter);
router.post("/:counterId/services", authorize("Admin"), assignServicesToCounter);

// Reset routes (Admin only)
router.post("/:counterId/reset", authorize("Admin"), resetCounterStatus);
router.post("/zone/:zoneId/reset-all", authorize("Admin"), resetAllCountersInZone);

export default router;