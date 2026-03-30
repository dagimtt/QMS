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
    enum: ['Waiting', 'Serving', 'Completed', 'Cancelled', 'Escalated', 'Priority'],
    default: 'Waiting',
    index: true
  },
  currentStep: {
    type: String,
    enum: ['Verification', 'Payment', 'Validation', 'Authorization', 'Completed'],
    default: 'Verification'
  },
  customerInfo: {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: ''
    },
    idNumber: {
      type: String,
      trim: true,
      default: ''
    }
  },
  assignedCounter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    index: true
  },
  calledAt: Date,
  servedAt: Date,
  completedAt: Date,
  waitingTime: {
    type: Number,
    default: 0
  },
  serviceTime: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number,
    default: 0
  },
  isPriority: {
    type: Boolean,
    default: false
  },
  priorityReason: {
    type: String,
    enum: ['VIP', 'Elderly', 'Disabled', 'Emergency', 'Rejoin', 'None'],
    default: 'None'
  },
  escalationDetails: {
    reason: String,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalatedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String
  },
  auditLog: [{
    action: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userRole: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }],
  notifications: {
    smsSent: {
      type: Boolean,
      default: false
    },
    emailSent: {
      type: Boolean,
      default: false
    },
    audioAnnounced: {
      type: Boolean,
      default: false
    }
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
ticketSchema.index({ status: 1, createdAt: 1 });
ticketSchema.index({ zone: 1, status: 1 });
ticketSchema.index({ assignedCounter: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

// Generate unique ticket number - static method
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
  if (lastTicket) {
    const lastSeq = parseInt(lastTicket.ticketNumber.slice(-4));
    sequence = lastSeq + 1;
  }
  
  return `${zoneCode}${groupCode}${dateStr}${sequence.toString().padStart(4, '0')}`;
};

// Calculate times - method
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

// Add audit log - method
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

// NO pre-save middleware - we'll handle calculations in the controller

export default mongoose.model("Ticket", ticketSchema);