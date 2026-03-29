import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN', 'LOGOUT', 'CREATE_USER', 'UPDATE_USER', 'DEACTIVATE_USER',
      'CREATE_ZONE', 'UPDATE_ZONE', 'DELETE_ZONE',
      'CREATE_GROUP', 'UPDATE_GROUP', 'DELETE_GROUP',
      'CREATE_COUNTER', 'UPDATE_COUNTER', 'DELETE_COUNTER', 'ASSIGN_COUNTER',
      'CREATE_SERVICE', 'UPDATE_SERVICE', 'DELETE_SERVICE',
      'CREATE_TICKET', 'CALL_TICKET', 'COMPLETE_TICKET', 'ESCALATE_TICKET',
      'PRINT_TICKET', 'REPORT_GENERATED'
    ]
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: String,
  targetType: {
    type: String,
    enum: ['User', 'Zone', 'Group', 'Counter', 'Service', 'Ticket', 'Report']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: true 
});

// Index for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.log = async function(data) {
  const log = new this(data);
  await log.save();
  return log;
};

// Method to get audit trail for specific entity
auditLogSchema.statics.getEntityHistory = async function(targetType, targetId, limit = 50) {
  return await this.find({ targetType, targetId })
    .populate('user', 'fullName email role')
    .sort({ timestamp: -1 })
    .limit(limit);
};

export default mongoose.model("AuditLog", auditLogSchema);