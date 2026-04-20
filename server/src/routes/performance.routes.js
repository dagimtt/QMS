import express from "express";
import { authenticateToken, authorize } from "../middleware/auth.js";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

const router = express.Router();

// ==================== KPI DASHBOARD ====================
// Get KPI dashboard data based on step completions
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
    
    // Match step completions (Verification, Payment, Validation, Authorization)
    const match = {
      completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
    };
    if (startDate) {
      match.completedAt = { $gte: startDate };
    }
    
    // Top performers by step completions
    const topPerformers = await Ticket.aggregate([
      { $match: match },
      { $match: { completedBy: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$completedBy',
          completions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' }
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
          completions: 1,
          avgTime: { $round: ['$avgTime', 0] }
        }
      },
      { $sort: { completions: -1 } },
      { $limit: 10 }
    ]);
    
    // Performance by role (based on the step they complete)
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
          totalCompletions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' }
        }
      },
      {
        $project: {
          role: '$_id',
          totalCompletions: 1,
          avgTime: { $round: ['$avgTime', 0] }
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
          totalCompletions: { $sum: 1 },
          overallAvgTime: { $avg: '$stepCompletionTime' },
          totalOfficers: { $addToSet: '$completedBy' }
        }
      },
      {
        $project: {
          totalCompletions: 1,
          overallAvgTime: { $round: ['$overallAvgTime', 0] },
          totalOfficers: { $size: '$totalOfficers' }
        }
      }
    ]);
    
    res.json({
      success: true,
      topPerformers,
      performanceByRole,
      overallStats: overallStats[0] || {
        totalCompletions: 0,
        overallAvgTime: 0,
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

// ==================== OFFICER MANAGEMENT ====================
// Get all officers in a specific zone with step-based performance
router.get("/zone/:zoneId/officers", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Get all groups in zone
    const groups = await Group.find({ zone: zoneId });
    const groupIds = groups.map(g => g._id);
    
    // Get all counters in zone
    const counters = await Counter.find({ group: { $in: groupIds } })
      .populate('assignedUser', 'fullName email role');
    
    // Get unique officers from counters
    const officers = counters
      .filter(c => c.assignedUser)
      .map(c => c.assignedUser)
      .filter((v, i, a) => a.findIndex(t => t._id.toString() === v._id.toString()) === i);
    
    // Get performance metrics for each officer based on step completions
    const officersWithPerformance = await Promise.all(officers.map(async (officer) => {
      // Get step completions by this officer
      const stepCompletions = await Ticket.find({
        completedBy: officer._id,
        completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
      });
      
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get weekly date range
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      
      // Get monthly date range
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - 1);
      monthStart.setHours(0, 0, 0, 0);
      
      // Filter by date ranges
      const todayCompletions = stepCompletions.filter(t => t.completedAt && new Date(t.completedAt) >= today);
      const weekCompletions = stepCompletions.filter(t => t.completedAt && new Date(t.completedAt) >= weekStart);
      const monthCompletions = stepCompletions.filter(t => t.completedAt && new Date(t.completedAt) >= monthStart);
      
      // Calculate metrics
      const calculateMetrics = (completions) => {
        if (completions.length === 0) return { total: 0, avgTime: 0, totalTime: 0 };
        const totalTime = completions.reduce((sum, t) => sum + (t.stepCompletionTime || 0), 0);
        return {
          total: completions.length,
          avgTime: Math.round(totalTime / completions.length),
          totalTime: totalTime
        };
      };
      
      const todayMetrics = calculateMetrics(todayCompletions);
      const weekMetrics = calculateMetrics(weekCompletions);
      const monthMetrics = calculateMetrics(monthCompletions);
      const overallMetrics = calculateMetrics(stepCompletions);
      
      // Step breakdown
      const stepBreakdown = {};
      stepCompletions.forEach(ticket => {
        const step = ticket.completedAtStep;
        if (!stepBreakdown[step]) {
          stepBreakdown[step] = { count: 0, totalTime: 0 };
        }
        stepBreakdown[step].count++;
        stepBreakdown[step].totalTime += ticket.stepCompletionTime || 0;
      });
      
      // Get escalated tickets
      const escalatedTickets = await Ticket.countDocuments({
        'escalationDetails.escalatedBy': officer._id
      });
      
      // Get called count
      const calledCount = stepCompletions.reduce((sum, t) => sum + (t.calledCount || 0), 0);
      
      // Calculate efficiency (optimal 60 seconds per step)
      const efficiency = overallMetrics.avgTime > 0 ? Math.max(0, Math.min(100, Math.round(100 / (overallMetrics.avgTime / 60)))) : 0;
      
      return {
        id: officer._id,
        name: officer.fullName,
        email: officer.email,
        role: officer.role,
        today: todayMetrics,
        week: weekMetrics,
        month: monthMetrics,
        overall: overallMetrics,
        stepBreakdown: Object.entries(stepBreakdown).map(([step, data]) => ({
          step,
          count: data.count,
          avgTime: Math.round(data.totalTime / data.count)
        })),
        escalatedCount: escalatedTickets,
        totalCalled: calledCount,
        completedCount: stepCompletions.length,
        efficiency: efficiency
      };
    }));
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code, id: zone._id },
      officers: officersWithPerformance,
      totalOfficers: officersWithPerformance.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get officers by zone error:', error);
    res.status(500).json({ success: false, message: 'Failed to get officers', error: error.message });
  }
});

// Get detailed performance for a specific officer with step-based metrics
router.get("/officer/:officerId/detailed", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { officerId } = req.params;
    const { period = 'week' } = req.query;
    
    const officer = await User.findById(officerId).select('-password -refreshToken');
    if (!officer) {
      return res.status(404).json({ success: false, message: 'Officer not found' });
    }
    
    // Get counter info
    const counter = await Counter.findOne({ assignedUser: officerId });
    
    // Date range based on period
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get all step completions by this officer
    const stepCompletions = await Ticket.find({
      completedBy: officerId,
      completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
      completedAt: { $gte: startDate }
    }).sort({ completedAt: -1 });
    
    // Get daily breakdown
    const dailyBreakdown = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }
          },
          completions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' },
          totalTime: { $sum: '$stepCompletionTime' }
        }
      },
      { $sort: { '_id.date': -1 } }
    ]);
    
    // Get step breakdown by type
    const stepBreakdown = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$completedAtStep',
          count: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' },
          totalTime: { $sum: '$stepCompletionTime' }
        }
      }
    ]);
    
    // Get escalated tickets
    const escalatedTickets = await Ticket.find({
      'escalationDetails.escalatedBy': officerId,
      createdAt: { $gte: startDate }
    }).populate('service', 'name code');
    
    // Calculate overall metrics
    const totalCompletions = stepCompletions.length;
    const avgTime = totalCompletions > 0 
      ? Math.round(stepCompletions.reduce((sum, t) => sum + (t.stepCompletionTime || 0), 0) / totalCompletions)
      : 0;
    const totalTime = stepCompletions.reduce((sum, t) => sum + (t.stepCompletionTime || 0), 0);
    
    // Calculate efficiency score (optimal 60 seconds per step)
    const efficiency = avgTime > 0 ? Math.max(0, Math.min(100, Math.round(100 / (avgTime / 60)))) : 0;
    
    // Get called count
    const calledCount = stepCompletions.reduce((sum, t) => sum + (t.calledCount || 0), 0);
    
    res.json({
      success: true,
      officer: {
        id: officer._id,
        name: officer.fullName,
        email: officer.email,
        role: officer.role,
        counter: counter ? {
          id: counter._id,
          number: counter.counterNumber,
          name: counter.name,
          type: counter.type
        } : null
      },
      period,
      dateRange: {
        start: startDate,
        end: new Date()
      },
      summary: {
        totalCompletions,
        avgTime,
        totalTime,
        efficiency,
        calledCount,
        escalatedCount: escalatedTickets.length
      },
      dailyBreakdown: dailyBreakdown.map(d => ({
        date: d._id.date,
        completions: d.completions,
        avgTime: Math.round(d.avgTime || 0)
      })),
      stepBreakdown: stepBreakdown.map(s => ({
        step: s._id,
        count: s.count,
        avgTime: Math.round(s.avgTime || 0)
      })),
      escalatedTickets: escalatedTickets.map(t => ({
        id: t._id,
        ticketNumber: t.ticketNumber,
        service: t.service?.name,
        reason: t.escalationDetails?.reason,
        escalatedAt: t.escalationDetails?.escalatedAt
      })),
      recentCompletions: stepCompletions.slice(0, 20).map(t => ({
        id: t._id,
        ticketNumber: t.ticketNumber,
        serviceName: t.service?.name,
        step: t.completedAtStep,
        time: t.stepCompletionTime,
        completedAt: t.completedAt
      }))
    });
  } catch (error) {
    console.error('Get officer detailed performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get officer performance', error: error.message });
  }
});

// Get zone performance summary by step
router.get("/zone/:zoneId/summary", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { period = 'week' } = req.query;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Date range
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get all groups in zone
    const groups = await Group.find({ zone: zoneId });
    const groupIds = groups.map(g => g._id);
    
    // Get all counters in zone
    const counters = await Counter.find({ group: { $in: groupIds } })
      .populate('assignedUser', 'fullName email role');
    
    const officerIds = counters.filter(c => c.assignedUser).map(c => c.assignedUser._id);
    
    // Zone performance metrics by step
    const zonePerformance = await Ticket.aggregate([
      {
        $match: {
          zone: new mongoose.Types.ObjectId(zoneId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$completedAtStep',
          totalCompletions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' },
          totalTime: { $sum: '$stepCompletionTime' }
        }
      },
      {
        $project: {
          step: '$_id',
          totalCompletions: 1,
          avgTime: { $round: ['$avgTime', 0] }
        }
      }
    ]);
    
    // Overall zone stats
    const overallStats = await Ticket.aggregate([
      {
        $match: {
          zone: new mongoose.Types.ObjectId(zoneId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalCompletions: { $sum: 1 },
          overallAvgTime: { $avg: '$stepCompletionTime' },
          uniqueOfficers: { $addToSet: '$completedBy' }
        }
      },
      {
        $project: {
          totalCompletions: 1,
          overallAvgTime: { $round: ['$overallAvgTime', 0] },
          activeOfficers: { $size: '$uniqueOfficers' }
        }
      }
    ]);
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code, id: zone._id },
      period,
      performanceByStep: zonePerformance,
      overall: overallStats[0] || {
        totalCompletions: 0,
        overallAvgTime: 0,
        activeOfficers: 0
      },
      totalOfficers: officerIds.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get zone performance summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get zone performance', error: error.message });
  }
});

// Get performance by role across zone
router.get("/zone/:zoneId/performance-by-role", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { period = 'week' } = req.query;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Date range
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get performance by role based on the step they complete
    const performanceByRole = await Ticket.aggregate([
      {
        $match: {
          zone: new mongoose.Types.ObjectId(zoneId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
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
          _id: {
            role: '$officer.role',
            step: '$completedAtStep'
          },
          count: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' }
        }
      },
      {
        $project: {
          role: '$_id.role',
          step: '$_id.step',
          count: 1,
          avgTime: { $round: ['$avgTime', 0] }
        }
      },
      { $sort: { role: 1, step: 1 } }
    ]);
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code },
      period,
      performanceByRole,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get zone performance by role error:', error);
    res.status(500).json({ success: false, message: 'Failed to get zone performance' });
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
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
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
          completions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' },
          totalTime: { $sum: '$stepCompletionTime' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Get escalated tickets count
    const escalatedCount = await Ticket.countDocuments({
      'escalationDetails.escalatedBy': officerId,
      createdAt: { $gte: startDate }
    });
    
    // Get called tickets count
    const calledTickets = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] },
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalCalled: { $sum: '$calledCount' }
        }
      }
    ]);
    
    const overallKPI = await Ticket.aggregate([
      {
        $match: {
          completedBy: new mongoose.Types.ObjectId(officerId),
          completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
        }
      },
      {
        $group: {
          _id: null,
          totalCompletions: { $sum: 1 },
          avgTime: { $avg: '$stepCompletionTime' },
          totalTime: { $sum: '$stepCompletionTime' }
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
      dailyStats: dailyStats.map(d => ({
        date: d.date,
        completions: d.completions,
        avgTime: Math.round(d.avgTime || 0)
      })),
      escalatedCount,
      totalCalled: calledTickets[0]?.totalCalled || 0,
      overallKPI: overallKPI[0] || {
        totalCompletions: 0,
        avgTime: 0,
        totalTime: 0
      },
      daysAnalyzed: parseInt(days)
    });
  } catch (error) {
    console.error('Get daily performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get daily performance' });
  }
});

// Get officer performance summary
router.get("/officer", authenticateToken, authorize("Supervisor", "Admin"), async (req, res) => {
  try {
    const { role, zoneId, limit = 50 } = req.query;
    
    const match = {};
    if (role) match.role = role;
    
    // Find officers based on role
    let officers = await User.find(match).select('-password -refreshToken');
    
    // If zoneId provided, filter by zone
    if (zoneId) {
      const groups = await Group.find({ zone: zoneId });
      const groupIds = groups.map(g => g._id);
      const counters = await Counter.find({ group: { $in: groupIds } }).populate('assignedUser');
      const officerIds = counters.filter(c => c.assignedUser).map(c => c.assignedUser._id.toString());
      officers = officers.filter(o => officerIds.includes(o._id.toString()));
    }
    
    // Get performance for each officer based on step completions
    const officersWithPerformance = await Promise.all(officers.map(async (officer) => {
      const completions = await Ticket.find({
        completedBy: officer._id,
        completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
      });
      
      const totalCompletions = completions.length;
      const avgTime = totalCompletions > 0 
        ? Math.round(completions.reduce((sum, t) => sum + (t.stepCompletionTime || 0), 0) / totalCompletions)
        : 0;
      
      const escalatedCount = await Ticket.countDocuments({
        'escalationDetails.escalatedBy': officer._id
      });
      
      return {
        id: officer._id,
        name: officer.fullName,
        email: officer.email,
        role: officer.role,
        totalCompletions,
        avgTime,
        escalatedCount,
        efficiency: avgTime > 0 ? Math.max(0, Math.min(100, Math.round(100 / (avgTime / 60)))) : 0
      };
    }));
    
    // Sort by total completions
    officersWithPerformance.sort((a, b) => b.totalCompletions - a.totalCompletions);
    
    res.json({
      success: true,
      officers: officersWithPerformance.slice(0, parseInt(limit)),
      total: officersWithPerformance.length,
      filters: { role, zoneId }
    });
  } catch (error) {
    console.error('Get officer performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to get officer performance' });
  }
});

export default router;