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
  getAvailableCounters
} from "../controllers/counter.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes (authenticated but not role-specific)
router.get("/", authenticateToken, getCounters);
router.get("/available", authenticateToken, getAvailableCounters);
router.get("/:id", authenticateToken, getCounterById);
router.get("/user/:userId", authenticateToken, getCountersByUser);

// Admin only routes
router.post("/", authenticateToken, authorize("Admin"), createCounter);
router.put("/:id", authenticateToken, authorize("Admin"), updateCounter);
router.delete("/:id", authenticateToken, authorize("Admin"), deleteCounter);

// User assignment routes (Admin only)
router.post("/:counterId/assign-user", authenticateToken, authorize("Admin"), assignUserToCounter);
router.delete("/:counterId/remove-user", authenticateToken, authorize("Admin"), removeUserFromCounter);

// Service assignment routes
router.post("/:counterId/services", authenticateToken, authorize("Admin"), assignServicesToCounter);

export default router;