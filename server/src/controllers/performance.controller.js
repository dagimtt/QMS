import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

// Get officers in a specific zone with step-based performance
export const getOfficersByZone = async (req, res) => {
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
      // Get step completions by this officer (Verification, Payment, Validation, Authorization)
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
      
      // Filter step completions by date ranges
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
      
      // Get step breakdown by type
      const stepBreakdown = {};
      stepCompletions.forEach(ticket => {
        const step = ticket.completedAtStep;
        if (!stepBreakdown[step]) {
          stepBreakdown[step] = { count: 0, totalTime: 0 };
        }
        stepBreakdown[step].count++;
        stepBreakdown[step].totalTime += ticket.stepCompletionTime || 0;
      });
      
      // Get escalated tickets by this officer
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
};

// Get detailed performance for a specific officer with step-based metrics
export const getOfficerDetailedPerformance = async (req, res) => {
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
    
    // Get call count
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
};

// Get zone performance summary by step
export const getZonePerformanceSummary = async (req, res) => {
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
};

// Get performance by role across zone
export const getZonePerformanceByRole = async (req, res) => {
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
};