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
  getZoneQueueStatus,
  getEscalatedTickets,
  resolveEscalation,
  getSupervisorDashboard,
  getTodayStats,  // Add this import
  getServingTicketsByZone
} from "../controllers/ticket.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public route for kiosk
router.post("/", createTicket);

// Stats route - add this BEFORE the :id route to avoid conflict
router.get("/stats/today", authenticateToken, getTodayStats);

// Counter operations
router.get("/counter/:counterId/dashboard", authenticateToken, getCounterDashboard);
router.post("/:counterId/call-next", authenticateToken, callNextTicket);
router.put("/:ticketId/complete", authenticateToken, completeTicket);
router.post("/:ticketId/absent", authenticateToken, markTicketAbsent);
router.post("/:ticketId/escalate", authenticateToken, escalateTicket);

// Supervisor operations
router.get("/supervisor/:zoneId/dashboard", authenticateToken, authorize("Supervisor", "Admin"), getSupervisorDashboard);
router.get("/escalated/:zoneId", authenticateToken, authorize("Supervisor", "Admin"), getEscalatedTickets);
router.post("/:ticketId/resolve-escalation", authenticateToken, authorize("Supervisor", "Admin"), resolveEscalation);

// Zone operations
router.get("/zone/:zoneId/queue", authenticateToken, getZoneQueueStatus);

// General ticket routes - :id must be LAST
router.get("/", authenticateToken, getTickets);
router.get("/:id", authenticateToken, getTicketById);
router.get("/zone/:zoneId/queue", authenticateToken, getServingTicketsByZone);

export default router;