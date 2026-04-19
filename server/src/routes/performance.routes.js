import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.js";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

const router = express.Router();

// Get KPI dashboard data
router.get("/dashboard", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate = new Date();
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    const match = { status: 'Completed' };
    if (startDate) {
      match.completedAt = { $gte: startDate };
    }
    
    // Top performers by tickets completed
    const topPerformers = await Ticket.aggregate([
      { $match: match },
      { $match: { completedBy: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$completedBy',
          ticketsCompleted: { $sum: 1 },
          avgServiceTime: { $avg: '$serviceTime' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'officer'
        }
      },
      { $unwind: '$officer' },
      {
        $project: {
          officerId: '$_id',
          officerName: '$officer.fullName',
          officerRole: '$officer.role',
          ticketsCompleted: 1,
          avgServiceTime: { $round: ['$avgServiceTime', 0] }
        }
      },
      { $sort: { ticketsCompleted: -1 } },
      { $limit: 10 }
    ]);
    
    // Performance by role
    const performanceByRole = await Ticket.aggregate([
      { $match: match },
      { $match: { completedBy: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'users',
          localField: 'completedBy',
          foreignField: '_id',
          as: 'officer'
        }
      },
      { $unwind: '$officer' },
      {
        $group: {
          _id: '$officer.role',
          totalTickets: { $sum: 1 },
          avgServiceTime: { $avg: '$serviceTime' },
          avgWaitTime: { $avg: '$waitingTime' }
        }
      },
      {
        $project: {
          role: '$_id',
          totalTickets: 1,
          avgServiceTime: { $round: ['$avgServiceTime', 0] },
          avgWaitTime: { $round: ['$avgWaitTime', 0] }
        }
      }
    ]);
    
    // Overall statistics
    const overallStats = await Ticket.aggregate([
      { $match: match },
      { $match: { completedBy: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          overallAvgServiceTime: { $avg: '$serviceTime' },
          overallAvgWaitTime: { $avg: '$waitingTime' },
          totalOfficers: { $addToSet: '$completedBy' }
        }
      },
      {
        $project: {
          totalTickets: 1,
          overallAvgServiceTime: { $round: ['$overallAvgServiceTime', 0] },
          overallAvgWaitTime: { $round: ['$overallAvgWaitTime', 0] },
          totalOfficers: { $size: '$totalOfficers' }
        }
      }
    ]);
    
    res.json({
      success: true,
      topPerformers,
      performanceByRole,
      overallStats: overallStats[0] || {
        totalTickets: 0,
        overallAvgServiceTime: 0,
        overallAvgWaitTime: 0,
        totalOfficers: 0
      },
      period,
      startDate
    });
  } catch (error) {
    console.error('Get KPI dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get KPI data' });
  }
});

// Get daily performance for specific officer
router.get("/officer/:officerId/daily", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { officerId } = req.params;
    const { days = 7 } = req.query;
    
    const officer = await User.findById(officerId).select('-password -refreshToken');
    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found' });
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const dailyStats = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          status: 'Completed',
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' }
          },
          date: { $first: '$completedAt' },
          ticketsCompleted: { $sum: 1 },
          avgServiceTime: { $avg: '$serviceTime' },
          totalServiceTime: { $sum: '$serviceTime' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    const overallKPI = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          avgServiceTime: { $avg: '$serviceTime' },
          avgWaitTime: { $avg: '$waitingTime' },
          totalServiceTime: { $sum: '$serviceTime' }
        }
      }
    ]);
    
    res.json({
      success: true,
      officer: {
        id: officer._id,
        name: officer.fullName,
        role: officer.role,
        email: officer.email
      },
      dailyStats,
      overallKPI: overallKPI[0] || {
        totalTickets: 0,
        avgServiceTime: 0,
        avgWaitTime: 0,
        totalServiceTime: 0
      },
      daysAnalyzed: parseInt(days)
    });
  } catch (error) {
    console.error('Get daily performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get daily performance' });
  }
});

export default router;