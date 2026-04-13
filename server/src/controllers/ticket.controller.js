import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
import Service from "../models/Service.js";
import Counter from "../models/Counter.js";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";
import User from "../models/User.js"; // Add this import

// Helper function to get queue position
async function getQueuePosition(zoneId, assignedTo) {
  const waitingCount = await Ticket.countDocuments({
    zone: zoneId,
    assignedTo: assignedTo,
    status: 'Waiting',
    assignedCounter: null
  });
  return waitingCount + 1;
}

// Create new ticket - NO PRE-ASSIGNMENT to specific counter
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
      zone = await Zone.findOne({ isActive: true });
    }
    
    if (!zone) {
      return res.status(404).json({ success: false, message: 'No active zone found' });
    }
    
    console.log('Using zone:', zone.name, zone.code);
    
    // Get group for this zone
    const groups = await Group.find({ zone: zone._id });
    const group = groups[0];
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'No group found in zone' });
    }
    
    // Generate ticket number
    const ticketNumber = await Ticket.generateTicketNumber(zone.code, group.code);
    const displayNumber = parseInt(ticketNumber.slice(-4)).toString();
    
    // Create ticket - NO counter assignment at creation
    const ticket = new Ticket({
      ticketNumber,
      zone: zone._id,
      group: group._id,
      service: serviceId,
      status: 'Waiting',
      currentStep: 'Verification',
      assignedTo: 'Verifier',
      assignedCounter: null,
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
          zone: zone.name,
          queuePosition: await getQueuePosition(zone._id, 'Verifier')
        }
      }]
    });
    
    await ticket.save();
    
    console.log(`Ticket ${ticketNumber} created and added to shared queue`);
    
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name code')
      .populate('zone', 'name code');
    
    const queuePosition = await getQueuePosition(zone._id, 'Verifier');
    
    res.status(201).json({
      success: true,
      ticket: {
        ...populatedTicket.toObject(),
        number: displayNumber,
        displayNumber: displayNumber,
        zoneName: zone.name,
        queuePosition: queuePosition,
        message: `Ticket ${displayNumber} created. You are number ${queuePosition} in queue.`
      }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket', error: error.message });
  }
};

// Call next ticket - First check assigned tickets, then shared queue
// Call next ticket - First check assigned tickets, then shared queue
export const callNextTicket = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    const counter = await Counter.findById(counterId).populate('group');
    if (!counter) {
      return res.status(404).json({ success: false, message: 'Counter not found' });
    }
    
    const group = await Group.findById(counter.group).populate('zone');
    const zone = group.zone;
    
    console.log(`Calling next ticket for ${counter.type} in zone ${zone.name}`);
    
    // Determine which step this counter handles based on its type
    let currentStep;
    switch (counter.type) {
      case 'Verifier':
        currentStep = 'Verification';
        break;
      case 'Cashier':
        currentStep = 'Payment';
        break;
      case 'Validator':
        currentStep = 'Validation';
        break;
      case 'Authorizer':
        currentStep = 'Authorization';
        break;
      default:
        currentStep = 'Verification';
    }
    
    // FIRST: Check for tickets already assigned to this counter (returned tickets)
    let nextTicket = await Ticket.findOne({
      assignedCounter: counterId,
      status: { $in: ['Waiting', 'Priority'] },
      $or: [
        { calledAt: { $exists: false } },
        { calledAt: null }
      ]
    }).sort({ isPriority: -1, createdAt: 1 });
    
    // SECOND: If no assigned tickets, get from shared queue
    if (!nextTicket) {
      nextTicket = await Ticket.findOne({
        zone: zone._id,
        assignedTo: counter.type,
        status: 'Waiting',
        currentStep: currentStep,
        assignedCounter: null
      }).sort({ isPriority: -1, createdAt: 1 });
    }
    
    if (!nextTicket) {
      return res.status(404).json({ success: false, message: 'No tickets waiting in queue' });
    }
    
    console.log(`Found ticket: ${nextTicket.ticketNumber}, assigning to counter ${counter.counterNumber}`);
    
    // Assign this ticket to the calling counter
    nextTicket.assignedCounter = counter._id;
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
    res.status(500).json({ success: false, message: 'Failed to call next ticket', error: error.message });
  }
};
// Complete ticket and move to next step
// Complete ticket and move to next step based on service workflow
export const completeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    console.log('Complete ticket request:', ticketId);
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    const zone = await Zone.findById(ticket.zone);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Get the service to know the workflow
    const service = await Service.findById(ticket.service);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    
    const currentStep = ticket.currentStep;
    const workflowPath = service.workflowPath || ['Verification', 'Validation', 'Authorization'];
    
    console.log('Service workflow:', workflowPath);
    console.log('Current step:', currentStep);
    
    // Find the index of current step in workflow
    const currentStepIndex = workflowPath.indexOf(currentStep);
    
    // Check if this is the last step
    const isLastStep = currentStepIndex === workflowPath.length - 1;
    
    if (isLastStep) {
      // Final step - complete the ticket
      ticket.status = 'Completed';
      ticket.completedAt = new Date();
      ticket.serviceTime = ticket.calledAt ? Math.floor((ticket.completedAt - ticket.calledAt) / 60000) : 0;
      ticket.assignedCounter = null;
      
      ticket.auditLog.push({
        action: 'Ticket Completed',
        user: req.user._id,
        userRole: req.user.role,
        timestamp: new Date(),
        details: { finalStep: currentStep, zone: zone.name, service: service.name }
      });
      
      await ticket.save();
      
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
        message: `Ticket ${formattedTicket.displayNumber} completed successfully for ${service.name}!`
      });
    }
    
    // Move to next step in workflow
    const nextStep = workflowPath[currentStepIndex + 1];
    
    // Map workflow step to counter type
    const stepToCounterType = {
      'Verification': 'Verifier',
      'Payment': 'Cashier',
      'Validation': 'Validator',
      'Authorization': 'Authorizer'
    };
    
    const requiredCounterType = stepToCounterType[nextStep];
    
    console.log(`Moving ticket from ${currentStep} to ${nextStep} (${requiredCounterType})`);
    
    // Update ticket for next step
    ticket.currentStep = nextStep;
    ticket.assignedTo = requiredCounterType;
    ticket.assignedCounter = null;
    ticket.status = 'Waiting';
    ticket.calledAt = null;
    
    ticket.auditLog.push({
      action: 'Step Completed',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { 
        completedStep: currentStep, 
        nextStep,
        service: service.name,
        zone: zone.name,
        message: `Ticket moved to ${requiredCounterType} queue`
      }
    });
    
    await ticket.save();
    
    // Clear current counter's current ticket
    await Counter.updateMany(
      { currentTicket: ticketId },
      { $unset: { currentTicket: "" }, status: 'Available' }
    );
    
    const formattedTicket = {
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      nextStep: nextStep,
      requiredCounterType: requiredCounterType
    };
    
    console.log(`Ticket updated: currentStep=${ticket.currentStep}, assignedTo=${ticket.assignedTo}`);
    
    res.json({
      success: true,
      ticket: formattedTicket,
      message: `Ticket ${formattedTicket.displayNumber} moved to ${requiredCounterType} (${nextStep}) queue.`
    });
  } catch (error) {
    console.error('Complete ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete ticket', error: error.message });
  }
};

// Mark ticket as absent
export const markTicketAbsent = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    console.log('Mark ticket absent request:', { ticketId });
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    console.log('Current ticket status:', ticket.status);
    
    // Allow marking as absent for Serving or Called tickets
    if (ticket.status !== 'Serving') {
      // Also allow if the ticket has been called but not yet serving
      if (ticket.calledAt && ticket.status === 'Waiting') {
        console.log('Ticket has been called but not serving, marking as absent');
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Only tickets that are currently being served can be marked as absent' 
        });
      }
    }
    
    const zone = await Zone.findById(ticket.zone);
    const counter = await Counter.findById(ticket.assignedCounter);
    
    // Update ticket status
    ticket.status = 'No-Show';
    ticket.assignedCounter = null;
    ticket.calledAt = null;
    ticket.lastCalledAt = null;
    
    ticket.auditLog.push({
      action: 'Ticket Marked Absent',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { 
        zone: zone?.name,
        counter: counter?.counterNumber
      }
    });
    
    await ticket.save();
    console.log('Ticket marked as absent:', ticket.ticketNumber);
    
    // Clear counter's current ticket and set status to Available
    if (counter) {
      counter.currentTicket = null;
      counter.status = 'Available';
      
      // Also remove from queue if present
      if (counter.queue) {
        counter.queue = counter.queue.filter(id => id.toString() !== ticketId);
      }
      await counter.save();
      console.log(`Counter ${counter.counterNumber} status updated to Available`);
    }
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`counter-${counter?._id}`).emit('ticket-absent', { ticketId });
      io.to(`zone-${ticket.zone}`).emit('queue-updated');
    }
    
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
    res.status(500).json({ success: false, message: 'Failed to mark ticket as absent', error: error.message });
  }
};
export const escalateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    
    console.log('Escalate request:', { ticketId, reason });
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Escalation reason is required.' 
      });
    }
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    if (ticket.status === 'Escalated') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket is already escalated' 
      });
    }
    
    if (ticket.status !== 'Serving') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket must be in serving status to escalate' 
      });
    }
    
    const zone = await Zone.findById(ticket.zone);
    const counter = await Counter.findById(ticket.assignedCounter);
    
    let originalUser = null;
    if (counter && counter.assignedUser) {
      originalUser = await User.findById(counter.assignedUser);
    }
    
    // Store the counter ID before clearing
    const originalCounterId = ticket.assignedCounter;
    const originalCounterNumber = counter?.counterNumber;
    
    // Update ticket for escalation
    ticket.status = 'Escalated';
    ticket.escalationDetails = {
      reason: reason.trim(),
      escalatedBy: req.user._id,
      escalatedAt: new Date(),
      originalCounter: originalCounterId,
      originalVerifier: counter?.assignedUser || null,
      action: 'pending',
      resolution: '',
      priorityReason: ''
    };
    ticket.assignedCounter = null;
    
    ticket.auditLog.push({
      action: 'Ticket Escalated',
      user: req.user._id,
      userRole: req.user.role,
      timestamp: new Date(),
      details: { 
        reason: reason.trim(),
        zone: zone?.name,
        originalCounter: originalCounterNumber,
        originalVerifier: originalUser?.fullName
      }
    });
    
    await ticket.save();
    
    // Clear counter's current ticket and set to Available
    if (counter) {
      counter.currentTicket = null;
      counter.status = 'Available';
      await counter.save();
    }
    
    const formattedTicket = {
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      escalationReason: reason.trim(),
      escalatedBy: req.user.fullName,
      escalatedAt: ticket.escalationDetails.escalatedAt,
      originalCounterNumber: originalCounterNumber,
      originalVerifierName: originalUser?.fullName
    };
    
    console.log('Ticket escalated successfully:', formattedTicket.displayNumber);
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`zone-${ticket.zone}`).emit('ticket-escalated', formattedTicket);
    }
    
    res.json({
      success: true,
      ticket: formattedTicket,
      message: `Ticket ${formattedTicket.displayNumber} escalated to Supervisor.`
    });
  } catch (error) {
    console.error('Escalate ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to escalate ticket', error: error.message });
  }
};

// Get escalated tickets for Supervisor
export const getEscalatedTickets = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const escalatedTickets = await Ticket.find({
      zone: zoneId,
      status: 'Escalated'
    })
    .populate('service', 'name code')
    .populate('escalationDetails.escalatedBy', 'fullName email role')
    .populate('escalationDetails.originalVerifier', 'fullName email role')
    .populate('escalationDetails.originalCounter', 'counterNumber name')
    .sort({ 'escalationDetails.escalatedAt': -1 });
    
    const formattedTickets = escalatedTickets.map(ticket => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      escalationReason: ticket.escalationDetails?.reason || 'No reason provided',
      escalatedAt: ticket.escalationDetails?.escalatedAt,
      escalatedBy: ticket.escalationDetails?.escalatedBy,
      originalCounterNumber: ticket.escalationDetails?.originalCounter?.counterNumber,
      originalCounterName: ticket.escalationDetails?.originalCounter?.name,
      originalVerifierName: ticket.escalationDetails?.originalVerifier?.fullName
    }));
    
    res.json({
      success: true,
      tickets: formattedTickets,
      count: formattedTickets.length
    });
  } catch (error) {
    console.error('Get escalated tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get escalated tickets' });
  }
};

export const resolveEscalation = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution, action } = req.body;
    
    console.log('Resolve escalation request:', { ticketId, resolution, action });
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    if (ticket.status !== 'Escalated') {
      return res.status(400).json({ success: false, message: 'Ticket is not escalated' });
    }
    
    const zone = await Zone.findById(ticket.zone);
    
    // Handle return to original counter (with or without priority)
    if (action === 'return' || action === 'priority_return') {
      const originalCounter = await Counter.findById(ticket.escalationDetails.originalCounter);
      
      if (!originalCounter) {
        return res.status(404).json({ success: false, message: 'Original counter not found' });
      }
      
      const isPriority = action === 'priority_return';
      
      console.log(`Returning ticket to counter ${originalCounter.counterNumber}, Priority: ${isPriority}, Counter Status: ${originalCounter.status}`);
      
      // Update ticket status
      if (isPriority) {
        ticket.status = 'Priority';
        ticket.isPriority = true;
        ticket.priorityReason = 'Priority Return';
      } else {
        ticket.status = 'Waiting';
        ticket.isPriority = false;
        ticket.priorityReason = '';
      }
      
      ticket.currentStep = ticket.currentStep;
      ticket.assignedTo = originalCounter.type === 'Verifier' ? 'Verifier' :
                         originalCounter.type === 'Validator' ? 'Validator' : 'Authorizer';
      ticket.assignedCounter = originalCounter._id;
      
      // CRITICAL: Clear calledAt so it appears as a waiting ticket
      ticket.calledAt = null;
      ticket.lastCalledAt = null;
      
      ticket.escalationDetails.action = isPriority ? 'priority_return' : 'returned';
      ticket.escalationDetails.resolvedBy = req.user._id;
      ticket.escalationDetails.resolvedAt = new Date();
      ticket.escalationDetails.resolution = resolution || (isPriority ? 'Returned with priority' : 'Returned to original counter');
      
      ticket.auditLog.push({
        action: isPriority ? 'Escalation Resolved - Priority Return' : 'Escalation Resolved - Returned',
        user: req.user._id,
        userRole: req.user.role,
        timestamp: new Date(),
        details: { 
          resolution: resolution || (isPriority ? 'Returned with priority' : 'Returned to original counter'),
          returnedTo: originalCounter.counterNumber,
          zone: zone.name,
          priority: isPriority,
          counterStatus: originalCounter.status
        }
      });
      
      await ticket.save();
      
      // Add to counter's queue
      originalCounter.queue = originalCounter.queue || [];
      if (isPriority) {
        originalCounter.queue.unshift(ticket._id);
        console.log(`Priority ticket added to FRONT of queue for counter ${originalCounter.counterNumber}`);
      } else {
        originalCounter.queue.push(ticket._id);
        console.log(`Normal ticket added to BACK of queue for counter ${originalCounter.counterNumber}`);
      }
      
      // If counter is available, set as current ticket
      if (originalCounter.status === 'Available') {
        originalCounter.currentTicket = ticket._id;
        originalCounter.status = 'Busy';
        console.log(`Counter ${originalCounter.counterNumber} is available, ticket set as current`);
      } else {
        console.log(`Counter ${originalCounter.counterNumber} is BUSY, ticket added to queue (position: ${originalCounter.queue.length})`);
        // Make sure current ticket is not overwritten
        originalCounter.currentTicket = originalCounter.currentTicket;
      }
      
      await originalCounter.save();
      
      // Emit socket events for real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(`counter-${originalCounter._id}`).emit('force-refresh');
        io.to(`counter-${originalCounter._id}`).emit('queue-updated', {
          counterId: originalCounter._id,
          queueLength: originalCounter.queue.length,
          ticket: {
            ...ticket.toObject(),
            displayNumber: ticket.ticketNumber.slice(-4)
          }
        });
      }
      
      const formattedTicket = {
        ...ticket.toObject(),
        number: ticket.ticketNumber.slice(-4),
        displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
        isPriority: isPriority,
        queuePosition: originalCounter.queue.length
      };
      
      return res.json({
        success: true,
        ticket: formattedTicket,
        message: `Ticket ${formattedTicket.displayNumber} ${isPriority ? 'returned with PRIORITY' : 'returned'} to Counter ${originalCounter.counterNumber}${originalCounter.status !== 'Available' ? ' (added to queue)' : ''}`
      });
    }
    
    // Handle resolve to shared queue
    else {
      ticket.status = 'Waiting';
      ticket.isPriority = false;
      ticket.priorityReason = '';
      ticket.currentStep = ticket.currentStep;
      ticket.assignedTo = ticket.escalationDetails.originalCounter ? 
        (ticket.escalationDetails.originalCounter.type === 'Verifier' ? 'Verifier' :
         ticket.escalationDetails.originalCounter.type === 'Validator' ? 'Validator' : 'Authorizer') : 'Verifier';
      ticket.assignedCounter = null;
      ticket.calledAt = null;
      ticket.lastCalledAt = null;
      ticket.escalationDetails.action = 'resolved';
      ticket.escalationDetails.resolvedBy = req.user._id;
      ticket.escalationDetails.resolvedAt = new Date();
      ticket.escalationDetails.resolution = resolution || 'Issue resolved';
      
      ticket.auditLog.push({
        action: 'Escalation Resolved',
        user: req.user._id,
        userRole: req.user.role,
        timestamp: new Date(),
        details: { 
          resolution: resolution || 'Issue resolved',
          zone: zone.name
        }
      });
      
      await ticket.save();
      
      const formattedTicket = {
        ...ticket.toObject(),
        number: ticket.ticketNumber.slice(-4),
        displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString()
      };
      
      return res.json({
        success: true,
        ticket: formattedTicket,
        message: `Ticket ${formattedTicket.displayNumber} resolved and returned to queue`
      });
    }
  } catch (error) {
    console.error('Resolve escalation error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve escalation', error: error.message });
  }
};

// Supervisor Dashboard
export const getSupervisorDashboard = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    console.log('Fetching supervisor dashboard for zone:', zoneId);
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    // Get escalated tickets - make sure we're getting the right ones
    const escalatedTickets = await Ticket.find({
      zone: zoneId,
      status: 'Escalated'
         })
    .populate('service', 'name code')
    .populate('escalationDetails.escalatedBy', 'fullName email role')
    .populate('escalationDetails.originalVerifier', 'fullName email role')
    .populate('escalationDetails.originalCounter', 'counterNumber name type')
    .sort({ 'escalationDetails.escalatedAt': -1 });
    
    console.log(`Found ${escalatedTickets.length} escalated tickets`);
    
    // Get all counters in zone
    const groups = await Group.find({ zone: zoneId });
    const groupIds = groups.map(g => g._id);
    const counters = await Counter.find({ group: { $in: groupIds } })
      .populate('assignedUser', 'fullName email role');
    
    // Get statistics
    const stats = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId) } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        escalated: { $sum: { $cond: [{ $eq: ['$status', 'Escalated'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Waiting'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
      }}
    ]);
    
    const formattedTickets = escalatedTickets.map(ticket => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      escalationReason: ticket.escalationDetails?.reason || 'No reason provided',
      escalatedAt: ticket.escalationDetails?.escalatedAt,
      escalatedBy: ticket.escalationDetails?.escalatedBy,
      originalCounterNumber: ticket.escalationDetails?.originalCounter?.counterNumber,
      originalCounterName: ticket.escalationDetails?.originalCounter?.name,
      originalVerifierName: ticket.escalationDetails?.originalVerifier?.fullName
    }));
    
    res.json({
      success: true,
      zone: { name: zone.name, code: zone.code },
      escalatedTickets: formattedTickets,
      counters: counters.map(c => ({
        id: c._id,
        counterNumber: c.counterNumber,
        name: c.name,
        type: c.type,
        status: c.status,
        assignedUser: c.assignedUser
      })),
      stats: stats[0] || { total: 0, escalated: 0, resolved: 0, completed: 0 },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get supervisor dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get supervisor dashboard', error: error.message });
  }
};

// Get counter dashboard - Shows both assigned tickets and shared queue tickets
// Get counter dashboard - Shows both assigned tickets and shared queue tickets
export const getCounterDashboard = async (req, res) => {
  try {
    const { counterId } = req.params;
    
    console.log('Fetching dashboard for counter:', counterId);
    
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
    console.log('Zone:', zone?.name);
    
    // Get current ticket being served
    let currentTicket = null;
    if (counter.currentTicket) {
      currentTicket = await Ticket.findById(counter.currentTicket)
        .populate('service', 'name code')
        .populate('customerInfo');
      console.log('Current ticket:', currentTicket?.ticketNumber);
    }
    
    // STEP 1: Get tickets ALREADY ASSIGNED to this counter
    const assignedTickets = await Ticket.find({
      assignedCounter: counterId,
      status: { $in: ['Waiting', 'Priority'] },
      $or: [
        { calledAt: { $exists: false } },
        { calledAt: null }
      ]
    })
    .populate('service', 'name code')
    .populate('customerInfo')
    .sort({ isPriority: -1, createdAt: 1 });
    
    console.log('Assigned tickets found:', assignedTickets.length);
    
    // STEP 2: Get the current step for this counter type
    let currentStep;
    switch (counter.type) {
      case 'Verifier':
        currentStep = 'Verification';
        break;
      case 'Cashier':
        currentStep = 'Payment';
        break;
      case 'Validator':
        currentStep = 'Validation';
        break;
      case 'Authorizer':
        currentStep = 'Authorization';
        break;
      default:
        currentStep = 'Verification';
    }
    
    // STEP 3: Get UNAssigned tickets from shared queue
    const unassignedTickets = await Ticket.find({
      zone: zone?._id,
      assignedTo: counter.type,
      status: 'Waiting',
      currentStep: currentStep,
      assignedCounter: null
    })
    .populate('service', 'name code')
    .populate('customerInfo')
    .sort({ isPriority: -1, createdAt: 1 });
    
    console.log('Unassigned tickets found:', unassignedTickets.length);
    
    // Combine both lists: assigned tickets first, then unassigned
    const allWaitingTickets = [...assignedTickets, ...unassignedTickets];
    
    console.log('Total waiting tickets:', allWaitingTickets.length);
    
    const formattedWaiting = allWaitingTickets.map((ticket, index) => ({
      ...ticket.toObject(),
      number: ticket.ticketNumber.slice(-4),
      displayNumber: parseInt(ticket.ticketNumber.slice(-4)).toString(),
      waitingTime: Math.floor((new Date() - new Date(ticket.createdAt)) / 60000),
      queuePosition: index + 1,
      isAssigned: ticket.assignedCounter !== null
    }));
    
    let formattedCurrent = null;
    if (currentTicket) {
      formattedCurrent = {
        ...currentTicket.toObject(),
        number: currentTicket.ticketNumber.slice(-4),
        displayNumber: parseInt(currentTicket.ticketNumber.slice(-4)).toString(),
        servingTime: currentTicket.calledAt ? Math.floor((new Date() - new Date(currentTicket.calledAt)) / 60000) : 0
      };
    }
    
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
      assignedCount: assignedTickets.length,
      unassignedCount: unassignedTickets.length,
      queueLength: allWaitingTickets.length,
      stats: stats[0] || { total: 0, completed: 0, waiting: 0, serving: 0, noShow: 0 },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get counter dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get counter dashboard', error: error.message });
  }
};


// Get all tickets
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

// Get ticket by ID
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

// Get zone queue status
export const getZoneQueueStatus = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }
    
    const waitingByStep = await Ticket.aggregate([
      { $match: { zone: new mongoose.Types.ObjectId(zoneId), status: 'Waiting', assignedCounter: null } },
      { $group: { _id: '$currentStep', count: { $sum: 1 } } }
    ]);
    
    const servingTickets = await Ticket.find({
      zone: zoneId,
      status: 'Serving'
    }).populate('assignedCounter', 'counterNumber name type')
      .populate('service', 'name code');
    
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
        verifiers: verifiers.filter(c => c.status === 'Available').length,
        validators: validators.filter(c => c.status === 'Available').length,
        authorizers: authorizers.filter(c => c.status === 'Available').length
      }
    });
  } catch (error) {
    console.error('Get zone queue status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get zone queue status' });
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
          averageWaitTime: { $avg: '$waitingTime' },
          averageServiceTime: { $avg: '$serviceTime' }
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
        averageWaitTime: 0,
        averageServiceTime: 0
      },
      date: today
    });
  } catch (error) {
    console.error('Get today stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get today\'s statistics',
      error: error.message 
    });
  }
};

export const getServingTicketsByZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const servingTickets = await Ticket.find({
      zone: zoneId,
      status: 'Serving'
    })
    .populate('service', 'name code')
    .populate('assignedCounter', 'counterNumber name')
    .populate('customerInfo')
    .sort({ calledAt: -1 });
    
    const formattedTickets = servingTickets.map(ticket => ({
      ...ticket.toObject(),
      displayNumber: ticket.ticketNumber.slice(-4)
    }));
    
    res.json({
      success: true,
      serving: formattedTickets,
      count: formattedTickets.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get serving tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get serving tickets' });
  }
};