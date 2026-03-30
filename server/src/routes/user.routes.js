import express from "express";
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deactivateUser,
  changePassword,
  assignCounterToUser,
  getUnassignedUsers
} from "../controllers/user.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get("/", authorize("Admin"), getUsers);
router.get("/unassigned", authorize("Admin"), getUnassignedUsers);
router.post("/", authorize("Admin"), createUser);

// Routes with params
router.get("/:id", authorize("Admin", "Supervisor"), getUserById);
router.put("/:id", authorize("Admin"), updateUser);
router.delete("/:id", authorize("Admin"), deactivateUser);
router.post("/:id/change-password", changePassword);
router.post("/:id/assign-counter", authorize("Admin"), assignCounterToUser);

export default router;