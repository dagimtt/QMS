import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import Service from "../models/Service.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";

const stepToCounterType = {
  'Verification': 'Verifier',
  'Validation': 'Validator',
  'Authorization': 'Authorizer'
};

// Create new ticket - assign to available counter in same zone
export const createTicket = async (req, res) => {
  try {
    const { serviceId, customerName, customerPhone, customerEmail, zoneId } = req.body;
    
    console.log('Creating ticket:', { serviceId, customerName, zoneId });
    
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    
    // Determine which zone to use
    let zone;
    if (zoneId) {
      zone = await Zone.findById(zoneId);
    } else {
      // Find first active zone
      zone = await Zone.findOne({ isActive: true });
    }
    
    if (!zone) {
      return res.status(404).json({ success: false, message: 'No active zone found' });
    }
    
    console.log('Using zone:', zone.name, zone.code);
    
    // Find available Verifier counter in this zone
    const verifierCounter = await zone.getAvailableCounter('Verifier');
    
    if (!verifierCounter) {
      return res.status(400).json({ 
        success: false, 
        message: `No available verifier in ${zone.name}. Please try again later.` 
      });
    }
    
    console.log('Assigned to counter:', verifierCounter.counterNumber);
    
    // Get group for this counter
    const group = await Group.findById(verifierCounter.group);
    
    // Generate ticket number
    const ticketNumber = await Ticket.generateTicketNumber(zone.code, group.code);
    const displayNumber = parseInt(ticketNumber.slice(-4)).toString();
    
    // Create ticket
    const ticket = new Ticket({
      ticketNumber,
      zone: zone._id,
      group: group._id,
      service: serviceId,
      status: 'Waiting',
      currentStep: 'Verification',
      assignedTo: 'Verifier',
      assignedCounter: verifierCounter._id,
      customerInfo: {
        name: customerName || '',
        phone: customerPhone || '',
        email: customerEmail || ''
      },
      auditLog: [{
        action: 'Ticket Created',
        userRole: 'Kiosk',
        details: { 
          service: service.name, 
          counter: verifierCounter.counterNumber,
          zone: zone.name
        }
      }]
    });
    
    await ticket.save();
    
    // Add to counter's queue
    verifierCounter.queue = verifierCounter.queue || [];
    verifierCounter.queue.push(ticket._id);
    await verifierCounter.save();
    
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name code')
      .populate('assignedCounter', 'counterNumber name type')
      .populate('zone', 'name code');
    
    res.status(201).json({
      success: true,
      ticket: {
        ...populatedTicket.toObject(),
        number: displayNumber,
        displayNumber: displayNumber,
        zoneName: zone.name
      },
      message: `Ticket ${displayNumber} created. Please go to ${verifierCounter.name || 'Counter ' + verifierCounter.counterNumber} in ${zone.name}`
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket', error: error.message });
  }
};

// Call next ticket for a counter - only from same zone
export const callNextTicket = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId).populate('group');
    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }
    
    // Get zone for this counter
    const group = await Group.findById(counter.group).populate('zone');
    const zone = group.zone;
    
    console.log(`Calling next ticket for ${counter.type} in zone ${zone.name}`);
    
    // Find next waiting ticket in the same zone, assigned to this counter type
    const nextTicket = await Ticket.findOne({
      assignedCounter: counterId,
      status: 'Waiting',
      currentStep: counter.type === 'Verifier' ? 'Verification' : 
                    counter.type === 'Validator' ? 'Validation' : 'Authorization'
    }).sort({ isPriority: -1, createdAt: 1 });
    
    if (!nextTicket) {
      return res.status(404).json({ success: false, message: 'No tickets waiting in queue' });
    }
    
    // Update ticket
    nextTicket.status = 'Serving';
    nextTicket.calledAt = new Date();
    nextTicket.calledCount = (nextTicket.calledCount || 0) + 1;
    nextTicket.lastCalledAt = new Date();
    
    nextTicket.auditLog.push({
      action: 'Ticket Called',
      user: req.user._id,
      userRole: req.user.role,
      details: { counter: counter.counterNumber, zone: zone.name }
    });
    
    await nextTicket.save();
    
    // Update counter
    counter.currentTicket = nextTicket._id;
    counter.status = 'Busy';
    await counter.save();
    
    const formattedTicket = {
      ...nextTicket.toObject(),
      number: nextTicket.ticketNumber.slice(-4),
      displayNumber: parseInt(nextTicket.ticketNumber.slice(-4)).toString(),
      zoneName: zone.name
    };
    
    res.json({
      success: true,
      ticket: formattedTicket,
      message: `Ticket ${formattedTicket.displayNumber} called to ${counter.name || 'Counter ' + counter.counterNumber}`
    });
  } catch (error) {
    console.error('Call next ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to call next ticket' });
  }
};

// Complete ticket and move to next step within same zone
export const completeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Get zone for this ticket
    const zone = await Zone.findById(ticket.zone);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    const currentStep = ticket.currentStep;
    
    if (currentStep === 'Authorization') {
      // Final step - complete the ticket
      ticket.status = 'Completed';
      ticket.completedAt = new Date();
      ticket.serviceTime = ticket.calledAt ? Math.floor((ticket.completedAt - ticket.calledAt) / 60000) : 0;
      
      ticket.auditLog.push({
        action: 'Ticket Completed',
        user: req.user._id,
        userRole: req.user.role,
        details: { finalStep: currentStep, zone: zone.name }
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
      
      return res.json({
        success: true,
        ticket: formattedTicket,
        message: `Ticket ${formattedTicket.displayNumber} completed successfully in ${zone.name}!`
      });
    }
    
    // Move to next step - find available counter of next type WITHIN SAME ZONE
    const nextStep = currentStep === 'Verification' ? 'Validation' : 'Authorization';
    const nextCounterType = stepToCounterType[nextStep];
    
    console.log(`Moving ticket to ${nextStep} in zone ${zone.name}`);
    
    // Find available counter of next type in the same zone
    const nextCounter = await zone.getAvailableCounter(nextCounterType);
    
    if (!nextCounter) {
      return res.status(400).json({
        success: false,
        message: `No available ${nextCounterType} in ${zone.name}. Please try again later.`
      });
    }
    
    console.log(`Assigned to ${nextCounterType} counter: ${nextCounter.counterNumber}`);
    
    // Update ticket for next step
    ticket.currentStep = nextStep;
    ticket.assignedTo = nextCounterType;
    ticket.assignedCounter = nextCounter._id;
    ticket.status = 'Waiting';
    ticket.calledAt = null;
    
    ticket.auditLog.push({
      action: 'Step Completed',
      user: req.user._id,
      userRole: req.user.role,
      details: { 
        completedStep: currentStep, 
        nextStep, 
        nextCounter: nextCounter.counterNumber,
        zone: zone.name
      }
    });
    
    await ticket.save();
    
    // Add to next counter's queue
    nextCounter.queue = nextCounter.queue || [];
    nextCounter.queue.push(ticket._id);
    await nextCounter.save();
    
    // Clear current counter's current ticket
    await Counter.updateMany(
      { currentTicket: ticketId },
      { $unset: { currentTicket: "" }, status: 'Available' }
    );
    
    const formattedTicket = {
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      nextCounterName: nextCounter.name || `Counter ${nextCounter.counterNumber}`
    };
    
    res.json({
      success: true,
      ticket: formattedTicket,
      message: `Ticket ${formattedTicket.displayNumber} moved to ${nextCounterType} (${nextCounter.name || 'Counter ' + nextCounter.counterNumber}) in ${zone.name}`
    });
  } catch (error) {
    console.error('Complete ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete ticket' });
  }
};

// Mark ticket as absent
export const markTicketAbsent = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    if (ticket.status !== 'Serving') {
      return res.status(400).json({ success: false, message: 'Ticket is not being served' });
    }
    
    const zone = await Zone.findById(ticket.zone);
    
    ticket.status = 'No-Show';
    ticket.auditLog.push({
      action: 'Ticket Marked Absent',
      user: req.user._id,
      userRole: req.user.role,
      details: { zone: zone?.name }
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
    res.status(500).json({ success: false, message: 'Failed to mark ticket as absent' });
  }
};

// Get counter dashboard with zone info
export const getCounterDashboard = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId)
      .populate('services', 'name code')
      .populate({
        path: 'group',
        populate: { path: 'zone', select: 'name code' }
      });
    
    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }
    
    const zone = counter.group?.zone;
    
    // Get current ticket
    let currentTicket = null;
    if (counter.currentTicket) {
      currentTicket = await Ticket.findById(counter.currentTicket)
        .populate('service', 'name code')
        .populate('customerInfo');
    }
    
    // Get waiting tickets for this counter in same zone
    const waitingTickets = await Ticket.find({
      assignedCounter: counterId,
      status: 'Waiting',
      zone: zone?._id
    })
    .populate('service', 'name code')
    .populate('customerInfo')
    .sort({ isPriority: -1, createdAt: 1 })
    .limit(20);
    
    const formattedWaiting = waitingTickets.map(ticket => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      waitingTime: Math.floor((new Date() - new Date(ticket.createdAt)) / 60000)
    }));
    
    // Format current ticket
    let formattedCurrent = null;
    if (currentTicket) {
      formattedCurrent = {
        ...currentTicket.toObject(),
        number: currentTicket.ticketNumber.slice(-4),
        displayNumber: parseInt(currentTicket.ticketNumber.slice(-4)).toString(),
        servingTime: currentTicket.calledAt ? Math.floor((new Date() - new Date(currentTicket.calledAt)) / 60000) : 0
      };
    }
    
    // Get statistics for this zone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = await Ticket.aggregate([
      { $match: { zone: zone?._id, createdAt: { $gte: today } } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        waiting: { $sum: { $cond: [{ $eq: ['$status', 'Waiting'] }, 1, 0] } },
        serving: { $sum: { $cond: [{ $eq: ['$status', 'Serving'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'No-Show'] }, 1, 0] } }
      }}
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
        zone: zone ? { name: zone.name, code: zone.code } : null
      },
      currentTicket: formattedCurrent,
      waitingTickets: formattedWaiting,
      stats: stats[0] || { total: 0, completed: 0, waiting: 0, serving: 0, noShow: 0 },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get counter dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get counter dashboard' });
  }
};

// Get zone queue status
export const getZoneQueueStatus = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Get waiting tickets by step
    const waitingByStep = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId), status: 'Waiting' } },
      { $group: { _id: '$currentStep', count: { $sum: 1 } } }
    ]);
    
    // Get serving tickets
    const servingTickets = await Ticket.find({
      zone: zoneId,
      status: 'Serving'
    }).populate('assignedCounter', 'counterNumber name type')
      .populate('service', 'name code');
    
    // Get available counters by type
    const verifiers = await zone.getCountersByType('Verifier');
    const validators = await zone.getCountersByType('Validator');
    const authorizers = await zone.getCountersByType('Authorizer');
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code },
      waiting: waitingByStep,
      serving: servingTickets.map(t => ({
        ...t.toObject(),
        displayNumber: t.ticketNumber.slice(-4)
      })),
      availableCounters: {
        verifiers: verifiers.length,
        validators: validators.length,
        authorizers: authorizers.length
      }
    });
  } catch (error) {
    console.error('Get zone queue status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get zone queue status' });
  }
};
// Add these exports at the end of the file

export const escalateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
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
      message: `Ticket ${formattedTicket.displayNumber} escalated`
    });
  } catch (error) {
    console.error('Escalate ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to escalate ticket' });
  }
};

export const getTickets = async (req, res) => {
  try {
    const { status, zone, limit = 100, page = 1 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (zone) query.zone = zone;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tickets = await Ticket.find(query)
      .populate('service', 'name code')
      .populate('zone', 'name code')
      .populate('assignedCounter', 'counterNumber name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Ticket.countDocuments(query);
    
    const formattedTickets = tickets.map(ticket => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString()
    }));
    
    res.json({ 
      success: true, 
      tickets: formattedTickets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get tickets' });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id)
      .populate('service', 'name code')
      .populate('zone', 'name code')
      .populate('assignedCounter', 'counterNumber name type');
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    const formattedTicket = {
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString()
    };
    
    res.json({ success: true, ticket: formattedTicket });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ticket' });
  }
};