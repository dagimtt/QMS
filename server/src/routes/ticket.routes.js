import express from "express";
import {
  createTicket,
  getTickets,
  getTicketById,
  callNextTicket,
  completeTicket,
  escalateTicket,
  markTicketAbsent,
  getCounterDashboard,
  getZoneQueueStatus
} from "../controllers/ticket.controller.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/", createTicket);

// Counter operations
router.get("/counter/:counterId/dashboard", authenticateToken, getCounterDashboard);
router.post("/:counterId/call-next", authenticateToken, callNextTicket);
router.put("/:ticketId/complete", authenticateToken, completeTicket);
router.post("/:ticketId/absent", authenticateToken, markTicketAbsent);
router.post("/:ticketId/escalate", authenticateToken, escalateTicket);

// Zone operations
router.get("/zone/:zoneId/queue", authenticateToken, getZoneQueueStatus);

// General ticket routes
router.get("/", authenticateToken, getTickets);
router.get("/:id", authenticateToken, getTicketById);

export default router;