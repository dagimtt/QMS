import express from "express";
import {
  createTicket,
  getTickets,
  getTicketById,
  callNextTicket,
  completeTicket,
  escalateTicket,
  getQueueStatus
} from "../controllers/ticket.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public route for kiosk (no authentication required)
router.post("/", createTicket);

// Protected routes
router.get("/", authenticateToken, getTickets);
router.get("/:id", authenticateToken, getTicketById);
router.post("/:counterId/call-next", authenticateToken, callNextTicket);
router.put("/:ticketId/complete", authenticateToken, completeTicket);
router.post("/:ticketId/escalate", authenticateToken, escalateTicket);
router.get("/queue/:zoneId", authenticateToken, getQueueStatus);

export default router;