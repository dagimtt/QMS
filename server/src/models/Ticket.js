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
    enum: ['Verification', 'Validation', 'Authorization', 'Completed'],
    default: 'Verification'
  },
  customerInfo: {
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' }
  },
  assignedCounter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter',
    index: true
  },
  // 
escalationDetails: {
  reason: String,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalatedAt: Date,
  originalCounter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  },
  originalVerifier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  resolution: String,
  action: {
    type: String,
    enum: ['resolved', 'returned'],
    default: 'resolved'
  }
},
  assignedTo: {
    type: String,
    enum: ['Verifier', 'Validator', 'Authorizer'],
    default: 'Verifier'
  },
  calledAt: Date,
  servedAt: Date,
  completedAt: Date,
  calledCount: { type: Number, default: 0 },
  lastCalledAt: Date,
  waitingTime: { type: Number, default: 0 },
  serviceTime: { type: Number, default: 0 },
  isPriority: { type: Boolean, default: false },
  auditLog: [{
    action: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userRole: String,
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

// Generate unique ticket number with zone code
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

export default mongoose.model("Ticket", ticketSchema);