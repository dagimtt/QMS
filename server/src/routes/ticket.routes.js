import express from "express";
import {
  createTicket,
  getTickets,
  getTicketById,
  getTicketByNumber,
  callNextTicket,
  completeTicket,
  escalateTicket,
  resolveEscalation,
  getQueueStatus,
  getTicketsByCounter,
  updateTicketPriority,
  getTodayStats,
  markTicketAbsent,
  getCounterDashboard
} from "../controllers/ticket.controller.js";
import { authenticateToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public route for kiosk (no authentication required)
router.post("/", createTicket);

// Counter dashboard and operations (authenticated)
router.get("/counter/:counterId/dashboard", authenticateToken, getCounterDashboard);
router.post("/counter/:counterId/call-next", authenticateToken, callNextTicket);
router.put("/ticket/:ticketId/complete", authenticateToken, completeTicket);
router.post("/ticket/:ticketId/escalate", authenticateToken, escalateTicket);
router.post("/ticket/:ticketId/absent", authenticateToken, markTicketAbsent);
router.post("/ticket/:ticketId/resolve-escalation", authenticateToken, resolveEscalation);
router.put("/ticket/:ticketId/priority", authenticateToken, updateTicketPriority);

// Alternative shorter routes (for backward compatibility)
router.post("/:counterId/call-next", authenticateToken, callNextTicket);
router.put("/:ticketId/complete", authenticateToken, completeTicket);
router.post("/:ticketId/escalate", authenticateToken, escalateTicket);
router.post("/:ticketId/absent", authenticateToken, markTicketAbsent);

// Protected routes
router.get("/", authenticateToken, getTickets);
router.get("/by-number/:ticketNumber", authenticateToken, getTicketByNumber);
router.get("/:id", authenticateToken, getTicketById);
router.get("/queue/:zoneId", authenticateToken, getQueueStatus);
router.get("/counter/:counterId/tickets", authenticateToken, getTicketsByCounter);
router.get("/stats/today", authenticateToken, getTodayStats);

export default router;