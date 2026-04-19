import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

// Get officer performance metrics
export const getOfficerPerformance = async (req, res) => {
  try {
    const { officerId, startDate, endDate, zoneId } = req.query;
    
    const match = {};
    
    if (officerId) {
      match['completedBy'] = new mongoose.Types.ObjectId(officerId);
    }
    
    if (startDate && endDate) {
      match['completedAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Get performance data
    const performance = await Ticket.aggregate([
      { $match: { status: 'Completed', completedBy: { $exists: true } } },
      ...(officerId ? [{ $match: { completedBy: new mongoose.Types.ObjectId(officerId) } }] : []),
      ...(startDate && endDate ? [{ $match: { completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } }] : []),
      {
        $group: {
          _id: '$completedBy',
          totalTickets: { $sum: 1 },
          totalServiceTime: { $sum: '$serviceTime' },
          averageServiceTime: { $avg: '$serviceTime' },
          totalWaitTime: { $sum: '$waitingTime' },
          averageWaitTime: { $avg: '$waitingTime' },
          ticketsByStep: {
            $push: {
              step: '$completedAtStep',
              time: '$stepCompletionTime'
            }
          }
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
          officerEmail: '$officer.email',
          officerRole: '$officer.role',
          totalTickets: 1,
          averageServiceTime: { $round: ['$averageServiceTime', 0] },
          averageWaitTime: { $round: ['$averageWaitTime', 0] },
          totalServiceTime: 1,
          totalWaitTime: 1,
          ticketsByStep: 1
        }
      },
      { $sort: { totalTickets: -1 } }
    ]);
    
    res.json({
      success: true,
      performance,
      filters: { officerId, startDate, endDate, zoneId }
    });
  } catch (error) {
    console.error('Get officer performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get performance data' });
  }
};

// Get performance for all officers in a zone
export const getZonePerformance = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { startDate, endDate, role } = req.query;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Get all groups in zone
    const groups = await Group.find({ zone: zoneId });
    const groupIds = groups.map(g => g._id);
    
    // Get all counters in zone
    const counters = await Counter.find({ group: { $in: groupIds } });
    const userIds = counters.filter(c => c.assignedUser).map(c => c.assignedUser);
    
    const match = {
      completedBy: { $in: userIds },
      status: 'Completed'
    };
    
    if (startDate && endDate) {
      match.completedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const performance = await Ticket.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$completedBy',
          totalTickets: { $sum: 1 },
          totalServiceTime: { $sum: '$serviceTime' },
          averageServiceTime: { $avg: '$serviceTime' },
          totalWaitTime: { $sum: '$waitingTime' },
          averageWaitTime: { $avg: '$waitingTime' }
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
        $match: role ? { 'officer.role': role } : {}
      },
      {
        $project: {
          officerId: '$_id',
          officerName: '$officer.fullName',
          officerEmail: '$officer.email',
          officerRole: '$officer.role',
          totalTickets: 1,
          averageServiceTime: { $round: ['$averageServiceTime', 0] },
          averageWaitTime: { $round: ['$averageWaitTime', 0] },
          totalServiceTime: 1,
          totalWaitTime: 1
        }
      },
      { $sort: { totalTickets: -1 } }
    ]);
    
    // Get zone statistics
    const zoneStats = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId), status: 'Completed' } },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          avgServiceTime: { $avg: '$serviceTime' },
          avgWaitTime: { $avg: '$waitingTime' }
        }
      }
    ]);
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code },
      performance,
      zoneStats: zoneStats[0] || { totalTickets: 0, avgServiceTime: 0, avgWaitTime: 0 },
      filters: { startDate, endDate, role }
    });
  } catch (error) {
    console.error('Get zone performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get zone performance' });
  }
};

// Get daily performance for an officer
export const getDailyPerformance = async (req, res) => {
  try {
    const { officerId } = req.params;
    const { days = 7 } = req.query;
    
    const officer = await User.findById(officerId);
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
    
    // Calculate overall KPI
    const overallStats = await Ticket.aggregate([
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
      overallKPI: overallStats[0] || {
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
};

// Get KPI dashboard for supervisors/admins
export const getKPIDashboard = async (req, res) => {
  try {
    const { zoneId, period = 'week' } = req.query;
    
    let startDate = new Date();
    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    const match = { status: 'Completed' };
    if (zoneId) {
      match.zone = new mongoose.Types.ObjectId(zoneId);
    }
    if (startDate) {
      match.completedAt = { $gte: startDate };
    }
    
    // Top performers by tickets completed
    const topPerformers = await Ticket.aggregate([
      { $match: match },
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
      period,
      startDate,
      topPerformers,
      performanceByRole,
      overallStats: overallStats[0] || {
        totalTickets: 0,
        overallAvgServiceTime: 0,
        overallAvgWaitTime: 0,
        totalOfficers: 0
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get KPI dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get KPI dashboard' });
  }
};

// Update ticket completion time (called when officer completes a ticket)
export const updateTicketCompletionTime = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { step, completionTime } = req.body;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    ticket.completedBy = req.user._id;
    ticket.completedAtStep = step;
    ticket.stepCompletionTime = completionTime;
    
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket completion time recorded'
    });
  } catch (error) {
    console.error('Update completion time error:', error);
    res.status(500).json({ success: false, message: 'Failed to update completion time' });
  }
};