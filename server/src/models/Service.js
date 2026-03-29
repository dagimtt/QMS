import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: [true, 'Service code is required'],
    uppercase: true,
    trim: true,
    unique: true,
    maxlength: [10, 'Service code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    enum: ['Regular', 'Premium', 'Emergency', 'Special'],
    default: 'Regular'
  },
  workflowPath: [{
    type: String,
    enum: ['Verification', 'Payment', 'Validation', 'Authorization'],
    default: ['Verification', 'Payment', 'Validation', 'Authorization']
  }],
  estimatedTime: {
    type: Number,
    default: 15,
    min: 1,
    max: 120,
    description: 'Estimated time in minutes'
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
    description: 'Higher priority gets served first'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  requirements: [{
    type: String,
    enum: ['ID Card', 'Passport', 'Application Form', 'Payment Receipt', 'Supporting Documents']
  }],
  fees: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    isRequired: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Virtual for assigned counters
serviceSchema.virtual('assignedCounters', {
  ref: 'Counter',
  localField: '_id',
  foreignField: 'services'
});

// Method to check if service can be deleted
serviceSchema.methods.canDelete = async function() {
  const Counter = mongoose.model('Counter');
  const countersCount = await Counter.countDocuments({ services: this._id });
  return countersCount === 0;
};

// Method to get current queue length for this service
serviceSchema.methods.getQueueLength = async function() {
  const Ticket = mongoose.model('Ticket');
  return await Ticket.countDocuments({
    service: this._id,
    status: 'Waiting'
  });
};

// Method to get estimated wait time
serviceSchema.methods.getEstimatedWaitTime = async function() {
  const queueLength = await this.getQueueLength();
  const activeCounters = await mongoose.model('Counter').countDocuments({
    services: this._id,
    isActive: true,
    status: 'Available'
  });
  
  if (activeCounters === 0) return null;
  return Math.ceil((queueLength * this.estimatedTime) / activeCounters);
};

// Pre-remove middleware
serviceSchema.pre('remove', async function(next) {
  try {
    const Counter = mongoose.model('Counter');
    const counters = await Counter.find({ services: this._id });
    if (counters.length > 0) {
      next(new Error('Cannot delete service that is assigned to counters. Remove service from counters first.'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Service", serviceSchema);