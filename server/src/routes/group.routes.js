import express from "express";
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup
} from "../controllers/group.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateToken, getGroups);
router.get("/:id", authenticateToken, getGroupById);
router.post("/", authenticateToken, authorize("Admin"), createGroup);
router.put("/:id", authenticateToken, authorize("Admin"), updateGroup);
router.delete("/:id", authenticateToken, authorize("Admin"), deleteGroup);

export default router;