import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Waiting', 'Serving', 'Completed', 'Cancelled', 'Escalated', 'Priority', 'No-Show'],
    default: 'Waiting',
    index: true
  },
  currentStep: {
    type: String,
    enum: ['Verification', 'Payment', 'Validation', 'Authorization', 'Completed'],
    default: 'Verification'
  },
  customerInfo: {
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    idNumber: { type: String, trim: true, default: '' }
  },
  assignedCounter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    index: true
  },
  assignedTo: {
    type: String,
    enum: ['Verifier', 'Cashier', 'Validator', 'Authorizer'],
    default: 'Verifier'
  },
  
  calledAt: Date,
  servedAt: Date,
  completedAt: Date,
  calledCount: { type: Number, default: 0 },
  lastCalledAt: Date,
  waitingTime: { type: Number, default: 0 },
  serviceTime: { type: Number, default: 0 },
  totalTime: { type: Number, default: 0 },
  isPriority: { type: Boolean, default: false },
  priorityReason: { type: String, default: '' },
  
  // ========== PERFORMANCE TRACKING FIELDS ==========
  // Track which officer completed this ticket/step
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Track which step was completed
  completedAtStep: {
    type: String,
    enum: ['Verification', 'Payment', 'Validation', 'Authorization', 'Completed'],
    default: null
  },
  // Time taken to complete this step (in seconds)
  stepCompletionTime: {
    type: Number,
    default: 0
  },
  // Track start time of each step for accurate performance measurement
  stepStartTime: {
    type: Date,
    default: null
  },
  // Performance metadata
  performanceMetrics: {
    responseTime: { type: Number, default: 0 },
    handlingTime: { type: Number, default: 0 },
    idleTime: { type: Number, default: 0 },
    efficiency: { type: Number, default: 0 }
  },

  // Escalation Details
  escalationDetails: {
    reason: { type: String, default: '' },
    escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    escalatedAt: Date,
    originalCounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter' },
    originalVerifier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolution: { type: String, default: '' },
    action: {
      type: String,
      enum: ['pending', 'resolved', 'returned', 'priority_return'],
      default: 'pending'
    },
    priorityReason: { type: String, default: '' }
  },
  
  auditLog: [{
    action: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userRole: String,
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }],
  
  notifications: {
    smsSent: { type: Boolean, default: false },
    emailSent: { type: Boolean, default: false },
    audioAnnounced: { type: Boolean, default: false }
  }
}, { 
  timestamps: true 
});

// Indexes
ticketSchema.index({ status: 1, createdAt: 1 });
ticketSchema.index({ zone: 1, status: 1 });
ticketSchema.index({ assignedCounter: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });
// Performance indexes
ticketSchema.index({ completedBy: 1, completedAt: -1 });
ticketSchema.index({ completedAtStep: 1, completedAt: -1 });
ticketSchema.index({ stepCompletionTime: 1 });

// Generate unique ticket number
ticketSchema.statics.generateTicketNumber = async function(zoneCode, groupCode) {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const lastTicket = await this.findOne({
    ticketNumber: new RegExp(`^${zoneCode}${groupCode}${dateStr}`)
  }).sort({ ticketNumber: -1 });
  
  let sequence = 1;
  if (lastTicket && lastTicket.ticketNumber) {
    const lastSeq = parseInt(lastTicket.ticketNumber.slice(-4));
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }
  
  return `${zoneCode}${groupCode}${dateStr}${sequence.toString().padStart(4, '0')}`;
};

// Method to calculate times
ticketSchema.methods.calculateTimes = function() {
  if (this.createdAt && this.completedAt) {
    this.totalTime = Math.floor((this.completedAt - this.createdAt) / 60000);
  }
  if (this.calledAt && this.completedAt) {
    this.serviceTime = Math.floor((this.completedAt - this.calledAt) / 60000);
  }
  if (this.createdAt && this.calledAt) {
    this.waitingTime = Math.floor((this.calledAt - this.createdAt) / 60000);
  }
  return this;
};

// Method to start tracking a step (called when ticket is assigned to officer)
ticketSchema.methods.startStep = function(step, user) {
  this.stepStartTime = new Date();
  this.completedBy = user;
  this.completedAtStep = step;
  return this;
};

// Method to complete a step and record performance
ticketSchema.methods.completeStep = function(step, user) {
  if (this.stepStartTime) {
    const completionTime = Math.floor((new Date() - this.stepStartTime) / 1000);
    this.stepCompletionTime = completionTime;
    this.serviceTime = completionTime;
    
    // Calculate efficiency score (lower time is better, optimal is 60 seconds)
    const optimalTime = 60;
    const efficiency = Math.max(0, Math.min(100, Math.round((optimalTime / completionTime) * 100)));
    this.performanceMetrics = {
      ...this.performanceMetrics,
      handlingTime: completionTime,
      efficiency: efficiency
    };
  }
  
  this.completedBy = user;
  this.completedAtStep = step;
  this.completedAt = new Date();
  
  return this;
};

// Method to calculate officer performance metrics by step
ticketSchema.statics.getOfficerPerformance = async function(officerId, startDate, endDate) {
  const match = {
    completedBy: officerId,
    completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
  };
  
  if (startDate && endDate) {
    match.completedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$completedAtStep',
        count: { $sum: 1 },
        avgTime: { $avg: '$stepCompletionTime' },
        totalTime: { $sum: '$stepCompletionTime' }
      }
    }
  ]);
  
  const totalStats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalCompletions: { $sum: 1 },
        overallAvgTime: { $avg: '$stepCompletionTime' },
        totalTime: { $sum: '$stepCompletionTime' }
      }
    }
  ]);
  
  return {
    byStep: stats,
    overall: totalStats[0] || { totalCompletions: 0, overallAvgTime: 0, totalTime: 0 }
  };
};

// Method to get all step completions for an officer
ticketSchema.statics.getOfficerStepCompletions = async function(officerId, step, limit = 50) {
  const match = {
    completedBy: officerId,
    completedAtStep: { $in: ['Verification', 'Payment', 'Validation', 'Authorization'] }
  };
  
  if (step) {
    match.completedAtStep = step;
  }
  
  return await this.find(match)
    .populate('service', 'name code')
    .sort({ completedAt: -1 })
    .limit(parseInt(limit));
};

// Add audit log
ticketSchema.methods.addAuditLog = function(action, user, details = {}) {
  this.auditLog.push({
    action,
    user: user?._id || user,
    userRole: user?.role,
    timestamp: new Date(),
    details
  });
  return this;
};

export default mongoose.model("Ticket", ticketSchema);