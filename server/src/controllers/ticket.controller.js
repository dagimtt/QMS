import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import Service from "../models/Service.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

// Map workflow steps to counter types
const stepToTypeMap = {
  'Verification': 'Verifier',
  'Payment': 'Cashier',
  'Validation': 'Validator',
  'Authorization': 'Authorizer'
};

export const createTicket = async (req, res) => {
  try {
    const { serviceId, customerName, customerPhone, customerEmail } = req.body;
    
    console.log('========================================');
    console.log('📝 Creating ticket:', { serviceId, customerName });
    
    // Validate service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      console.log('❌ Service not found:', serviceId);
      return res.status(404).json({ 
        success: false,
        message: 'Service not found. Please select a valid service.' 
      });
    }
    
    console.log('✅ Service found:', service.name);
    
    // Determine first step
    const firstStep = service.workflowPath && service.workflowPath.length > 0 
      ? service.workflowPath[0] 
      : 'Verification';
    
    const requiredCounterType = stepToTypeMap[firstStep] || firstStep;
    
    console.log('🎯 Required counter type:', requiredCounterType);
    
    // Find counter
    let counter = await Counter.findOne({
      services: serviceId,
      type: requiredCounterType,
      isActive: true,
      status: 'Available'
    });
    
    if (!counter) {
      // Try any available counter with this service
      counter = await Counter.findOne({
        services: serviceId,
        isActive: true,
        status: 'Available'
      });
    }
    
    if (!counter) {
      return res.status(400).json({ 
        success: false,
        message: 'No available counter for this service at the moment.' 
      });
    }
    
    console.log('✅ Counter found:', counter.counterNumber);
    
    // Get group
    const group = await Group.findById(counter.group);
    if (!group) {
      return res.status(404).json({ 
        success: false,
        message: 'Group configuration error.' 
      });
    }
    
    console.log('✅ Group found:', group.name);
    
    // Get zone
    let zone = await Zone.findById(group.zone);
    if (!zone) {
      return res.status(404).json({ 
        success: false,
        message: 'Zone configuration error.' 
      });
    }
    
    console.log('✅ Zone found:', zone.name);
    
    // Generate unique ticket number
    const ticketNumber = await Ticket.generateTicketNumber(zone.code, group.code);
    console.log('🎫 Generated ticket number:', ticketNumber);
    
    // Create ticket - directly without using pre-save hooks
    const ticket = new Ticket({
      ticketNumber,
      zone: zone._id,
      group: group._id,
      service: serviceId,
      status: 'Waiting',
      currentStep: firstStep,
      customerInfo: {
        name: customerName || '',
        phone: customerPhone || '',
        email: customerEmail || ''
      },
      assignedCounter: counter._id,
      createdAt: new Date(),
      isPriority: false,
      auditLog: []
    });
    
    // Save ticket
    await ticket.save();
    console.log('💾 Ticket saved');
    
    // Add audit log separately
    ticket.auditLog.push({
      action: 'Ticket Created',
      user: null,
      userRole: 'Kiosk',
      timestamp: new Date(),
      details: { 
        service: service.name, 
        counter: counter.counterNumber,
        ticketNumber: ticketNumber
      }
    });
    
    await ticket.save();
    console.log('📝 Audit log added');
    
    // Populate response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name code')
      .populate('zone', 'name code')
      .populate('group', 'name code')
      .populate('assignedCounter', 'counterNumber name');
    
    console.log('========================================');
    console.log('✅ TICKET CREATED:', ticketNumber);
    console.log('========================================');
    
    res.status(201).json({
      success: true,
      ticket: populatedTicket,
      message: `Ticket ${ticketNumber} created successfully. Please go to ${counter.name || 'Counter ' + counter.counterNumber}`
    });
  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create ticket', 
      error: error.message 
    });
  }
};

export const getTickets = async (req, res) => {
  try {
    const { status, counter, zone, startDate, endDate, limit = 100, page = 1 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (counter) query.assignedCounter = counter;
    if (zone) query.zone = zone;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tickets = await Ticket.find(query)
      .populate('service', 'name code estimatedTime')
      .populate('zone', 'name code')
      .populate('group', 'name code')
      .populate('assignedCounter', 'counterNumber name type')
      .sort({ isPriority: -1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Ticket.countDocuments(query);
    
    res.json({ 
      success: true, 
      tickets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get tickets',
      error: error.message 
    });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id)
      .populate('service', 'name code estimatedTime workflowPath category')
      .populate('zone', 'name code')
      .populate('group', 'name code')
      .populate('assignedCounter', 'counterNumber name type')
      .populate('auditLog.user', 'fullName email role');
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get ticket',
      error: error.message 
    });
  }
};

export const getTicketByNumber = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    
    const ticket = await Ticket.findOne({ ticketNumber })
      .populate('service', 'name code estimatedTime workflowPath')
      .populate('zone', 'name code')
      .populate('group', 'name code')
      .populate('assignedCounter', 'counterNumber name type');
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Get ticket by number error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get ticket',
      error: error.message 
    });
  }
};

export const callNextTicket = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId);
    if (!counter) {
      return res.status(404).json({ 
        success: false,
        message: 'Counter not found' 
      });
    }
    
    // Find next waiting ticket for this counter
    const ticket = await Ticket.findOneAndUpdate(
      { 
        assignedCounter: counterId,
        status: 'Waiting',
        currentStep: counter.type
      },
      { 
        status: 'Serving',
        calledAt: new Date()
      },
      { 
        sort: { isPriority: -1, createdAt: 1 }, 
        new: true 
      }
    ).populate('service', 'name code')
     .populate('zone', 'name code')
     .populate('group', 'name code');
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'No waiting tickets for this counter' 
      });
    }
    
    // Update counter with current ticket
    counter.currentTicket = ticket._id;
    counter.status = 'Busy';
    await counter.save();
    
    // Add audit log
    ticket.auditLog.push({
      action: 'Ticket Called',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { counter: counter.counterNumber }
    });
    await ticket.save();
    
    res.json({ 
      success: true, 
      ticket,
      message: `Ticket ${ticket.ticketNumber} called to counter ${counter.counterNumber}`
    });
  } catch (error) {
    console.error('Call next ticket error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to call next ticket',
      error: error.message 
    });
  }
};

export const completeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    // Check if there's a next step in the workflow
    const service = await Service.findById(ticket.service);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found' 
      });
    }
    
    const currentStepIndex = service.workflowPath.indexOf(ticket.currentStep);
    
    if (currentStepIndex < service.workflowPath.length - 1) {
      // Move to next step
      const nextStep = service.workflowPath[currentStepIndex + 1];
      const requiredCounterType = stepToTypeMap[nextStep] || nextStep;
      
      ticket.currentStep = nextStep;
      ticket.status = 'Waiting';
      
      // Find next counter for this step
      const nextCounter = await Counter.findOne({
        services: ticket.service,
        type: requiredCounterType,
        isActive: true,
        status: 'Available'
      });
      
      if (nextCounter) {
        ticket.assignedCounter = nextCounter._id;
      }
      
      ticket.auditLog.push({
        action: 'Step Completed',
        user: req.user._id,
        userRole: req.user.role,
        timestamp: new Date(),
        details: { completedStep: ticket.currentStep, nextStep }
      });
      
      await ticket.save();
      
      // Clear old counter's current ticket
      await Counter.updateMany(
        { currentTicket: ticketId },
        { $unset: { currentTicket: "" }, status: 'Available' }
      );
      
      res.json({ 
        success: true, 
        ticket,
        message: `Ticket ${ticket.ticketNumber} moved to ${nextStep} step. Please go to ${nextCounter?.name || 'next counter'}.`
      });
    } else {
      // Final step - complete the ticket
      ticket.status = 'Completed';
      ticket.completedAt = new Date();
      ticket.serviceTime = ticket.calledAt 
        ? Math.floor((ticket.completedAt - ticket.calledAt) / 60000)
        : 0;
      
      ticket.auditLog.push({
        action: 'Ticket Completed',
        user: req.user._id,
        userRole: req.user.role,
        timestamp: new Date(),
        details: { finalStep: ticket.currentStep }
      });
      
      await ticket.save();
      
      // Clear counter's current ticket
      await Counter.updateMany(
        { currentTicket: ticketId },
        { $unset: { currentTicket: "" }, status: 'Available' }
      );
      
      res.json({ 
        success: true, 
        ticket,
        message: `Ticket ${ticket.ticketNumber} completed successfully. Thank you!`
      });
    }
  } catch (error) {
    console.error('Complete ticket error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to complete ticket',
      error: error.message 
    });
  }
};

export const escalateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    ticket.status = 'Escalated';
    ticket.escalationDetails = {
      reason: reason || 'No reason provided',
      escalatedBy: req.user._id,
      escalatedAt: new Date()
    };
    
    ticket.auditLog.push({
      action: 'Ticket Escalated',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { reason: reason || 'No reason provided' }
    });
    
    await ticket.save();
    
    // Clear counter's current ticket
    if (ticket.assignedCounter) {
      await Counter.updateMany(
        { currentTicket: ticketId },
        { $unset: { currentTicket: "" }, status: 'Available' }
      );
    }
    
    res.json({ 
      success: true, 
      ticket,
      message: `Ticket ${ticket.ticketNumber} escalated successfully`
    });
  } catch (error) {
    console.error('Escalate ticket error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to escalate ticket',
      error: error.message 
    });
  }
};

export const resolveEscalation = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    if (ticket.status !== 'Escalated') {
      return res.status(400).json({ 
        success: false,
        message: 'Ticket is not escalated' 
      });
    }
    
    ticket.status = 'Waiting';
    ticket.escalationDetails.resolvedBy = req.user._id;
    ticket.escalationDetails.resolvedAt = new Date();
    ticket.escalationDetails.resolution = resolution || 'Resolved';
    
    ticket.auditLog.push({
      action: 'Escalation Resolved',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { resolution: resolution || 'Resolved' }
    });
    
    await ticket.save();
    
    res.json({ 
      success: true, 
      ticket,
      message: `Escalation for ticket ${ticket.ticketNumber} resolved`
    });
  } catch (error) {
    console.error('Resolve escalation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to resolve escalation',
      error: error.message 
    });
  }
};

export const getQueueStatus = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    // Get waiting tickets grouped by service
    const waitingTickets = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId), status: 'Waiting' } },
      { $group: {
        _id: '$service',
        count: { $sum: 1 },
        tickets: { $push: { 
          ticketNumber: '$ticketNumber', 
          waitingTime: { $subtract: [new Date(), '$createdAt'] },
          customerName: '$customerInfo.name'
        } }
      }},
      { $lookup: {
        from: 'services',
        localField: '_id',
        foreignField: '_id',
        as: 'service'
      }},
      { $unwind: '$service' },
      { $project: {
        serviceName: '$service.name',
        serviceCode: '$service.code',
        count: 1,
        tickets: { $slice: ['$tickets', 10] }
      }}
    ]);
    
    // Get serving tickets
    const servingTickets = await Ticket.find({
      zone: zoneId,
      status: 'Serving'
    }).populate('assignedCounter', 'counterNumber name')
      .populate('service', 'name code');
    
    // Get statistics
    const stats = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId) } },
      { $group: {
        _id: null,
        totalToday: { $sum: 1 },
        waiting: { $sum: { $cond: [{ $eq: ['$status', 'Waiting'] }, 1, 0] } },
        serving: { $sum: { $cond: [{ $eq: ['$status', 'Serving'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        escalated: { $sum: { $cond: [{ $eq: ['$status', 'Escalated'] }, 1, 0] } }
      }}
    ]);
    
    res.json({
      success: true,
      statistics: stats[0] || { totalToday: 0, waiting: 0, serving: 0, completed: 0, escalated: 0 },
      waitingByService: waitingTickets,
      currentlyServing: servingTickets,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get queue status',
      error: error.message 
    });
  }
};

export const getTicketsByCounter = async (req, res) => {
  try {
    const { counterId } = req.params;
    const { status, limit = 20, page = 1 } = req.query;
    
    const query = { assignedCounter: counterId };
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tickets = await Ticket.find(query)
      .populate('service', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Ticket.countDocuments(query);
    
    res.json({ 
      success: true, 
      tickets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get tickets by counter error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get tickets',
      error: error.message 
    });
  }
};

export const updateTicketPriority = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { isPriority, reason } = req.body;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    ticket.isPriority = isPriority;
    if (isPriority) {
      ticket.priorityReason = reason || 'VIP';
      ticket.status = 'Priority';
    } else {
      ticket.priorityReason = 'None';
      if (ticket.status === 'Priority') {
        ticket.status = 'Waiting';
      }
    }
    
    ticket.auditLog.push({
      action: isPriority ? 'Priority Set' : 'Priority Removed',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { reason: reason || 'VIP' }
    });
    
    await ticket.save();
    
    res.json({ 
      success: true, 
      ticket,
      message: isPriority ? `Priority set for ticket ${ticket.ticketNumber}` : `Priority removed from ticket ${ticket.ticketNumber}`
    });
  } catch (error) {
    console.error('Update ticket priority error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update ticket priority',
      error: error.message 
    });
  }
};

export const getTodayStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const stats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          completedTickets: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          waitingTickets: { $sum: { $cond: [{ $eq: ['$status', 'Waiting'] }, 1, 0] } },
          servingTickets: { $sum: { $cond: [{ $eq: ['$status', 'Serving'] }, 1, 0] } },
          escalatedTickets: { $sum: { $cond: [{ $eq: ['$status', 'Escalated'] }, 1, 0] } },
          avgWaitTime: { $avg: '$waitingTime' },
          avgServiceTime: { $avg: '$serviceTime' }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: stats[0] || {
        totalTickets: 0,
        completedTickets: 0,
        waitingTickets: 0,
        servingTickets: 0,
        escalatedTickets: 0,
        avgWaitTime: 0,
        avgServiceTime: 0
      },
      date: today
    });
  } catch (error) {
    console.error('Get today stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get statistics',
      error: error.message 
    });
  }
};
export const markTicketAbsent = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found' 
      });
    }
    
    // Only allow marking as absent if ticket is currently being served
    if (ticket.status !== 'Serving') {
      return res.status(400).json({ 
        success: false,
        message: 'Only tickets that are currently being served can be marked as absent' 
      });
    }
    
    ticket.status = 'No-Show';
    ticket.auditLog.push({
      action: 'Ticket Marked Absent',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { reason: 'Customer absent' }
    });
    
    await ticket.save();
    
    // Clear counter's current ticket
    await Counter.updateMany(
      { currentTicket: ticketId },
      { $unset: { currentTicket: "" }, status: 'Available' }
    );
    
    const formattedTicket = {
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString()
    };
    
    res.json({ 
      success: true, 
      ticket: formattedTicket,
      message: `Ticket ${formattedTicket.displayNumber} marked as absent`
    });
  } catch (error) {
    console.error('Mark ticket absent error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark ticket as absent',
      error: error.message 
    });
  }
};

export const getCounterDashboard = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    // Get counter details
    const counter = await Counter.findById(counterId)
      .populate('services', 'name code')
      .populate('assignedUser', 'fullName email role');
    
    if (!counter) {
      return res.status(404).json({ 
        success: false,
        message: 'Counter not found' 
      });
    }
    
    // Get current serving ticket
    let currentTicket = null;
    if (counter.currentTicket) {
      currentTicket = await Ticket.findById(counter.currentTicket)
        .populate('service', 'name code')
        .populate('customerInfo');
    }
    
    // Get waiting tickets for this counter
    const waitingTickets = await Ticket.find({
      assignedCounter: counterId,
      status: 'Waiting'
    })
    .populate('service', 'name code')
    .populate('customerInfo')
    .sort({ isPriority: -1, createdAt: 1 })
    .limit(20);
    
    // Format waiting tickets with display numbers
    const formattedWaiting = waitingTickets.map(ticket => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      waitingTime: Math.floor((new Date() - new Date(ticket.createdAt)) / 60000)
    }));
    
    // Format current ticket if exists
    let formattedCurrent = null;
    if (currentTicket) {
      formattedCurrent = {
        ...currentTicket.toObject(),
        number: currentTicket.ticketNumber.slice(-4),
        displayNumber: parseInt(currentTicket.ticketNumber.slice(-4)).toString(),
        servingTime: currentTicket.calledAt ? Math.floor((new Date() - new Date(currentTicket.calledAt)) / 60000) : 0
      };
    }
    
    // Get today's stats for this counter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = await Ticket.aggregate([
      {
        $match: {
          assignedCounter: counter._id,
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          waiting: { $sum: { $cond: [{ $eq: ['$status', 'Waiting'] }, 1, 0] } },
          serving: { $sum: { $cond: [{ $eq: ['$status', 'Serving'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'No-Show'] }, 1, 0] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      counter: {
        id: counter._id,
        counterNumber: counter.counterNumber,
        name: counter.name,
        type: counter.type,
        status: counter.status,
        services: counter.services,
        assignedUser: counter.assignedUser
      },
      currentTicket: formattedCurrent,
      waitingTickets: formattedWaiting,
      stats: stats[0] || { total: 0, completed: 0, waiting: 0, serving: 0, noShow: 0 },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get counter dashboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get counter dashboard',
      error: error.message 
    });
  }
};