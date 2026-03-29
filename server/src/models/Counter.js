import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  counterNumber: {
    type: String,
    required: [true, 'Counter number is required'],
    trim: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    trim: true,
    default: function() {
      return `Counter ${this.counterNumber}`;
    }
  },
  type: {
    type: String,
    enum: {
      values: ['Verifier', 'Cashier', 'Validator', 'Authorizer', 'Supervisor', 'Assistant Desk'],
      message: '{VALUE} is not a valid counter type'
    },
    required: [true, 'Counter type is required']
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required']
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  currentTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['Available', 'Busy', 'Offline', 'Break'],
    default: 'Available'
  },
  workingHours: {
    start: {
      type: String,
      default: '09:00'
    },
    end: {
      type: String,
      default: '17:00'
    },
    breakStart: String,
    breakEnd: String
  },
  performance: {
    ticketsServed: {
      type: Number,
      default: 0
    },
    averageServiceTime: {
      type: Number,
      default: 0
    },
    lastServedAt: Date
  },
  settings: {
    autoCall: {
      type: Boolean,
      default: false
    },
    autoCallDelay: {
      type: Number,
      default: 30,
      min: 0,
      max: 300
    }
  }
}, { 
  timestamps: true 
});

// Virtual for zone information
counterSchema.virtual('zoneInfo').get(async function() {
  const Group = mongoose.model('Group');
  const group = await Group.findById(this.group).populate('zone');
  return group?.zone;
});

// Method to check if counter can accept new tickets
counterSchema.methods.canAcceptTicket = function(serviceId) {
  if (!this.isActive) return false;
  if (this.status !== 'Available') return false;
  if (this.services.length === 0) return false;
  if (serviceId && !this.services.includes(serviceId)) return false;
  return true;
};

// Method to update performance metrics
counterSchema.methods.updatePerformance = async function(serviceTime) {
  const totalTime = (this.performance.averageServiceTime * this.performance.ticketsServed) + serviceTime;
  this.performance.ticketsServed += 1;
  this.performance.averageServiceTime = totalTime / this.performance.ticketsServed;
  this.performance.lastServedAt = new Date();
  await this.save();
};

// Method to get current queue length
counterSchema.methods.getQueueLength = async function() {
  const Ticket = mongoose.model('Ticket');
  return await Ticket.countDocuments({
    assignedCounter: this._id,
    status: 'Waiting'
  });
};

// Pre-save middleware
counterSchema.pre('save', async function(next) {
  // Check if user assignment is valid
  if (this.assignedUser) {
    const User = mongoose.model('User');
    const user = await User.findById(this.assignedUser);
    if (!user) {
      next(new Error('Assigned user does not exist'));
    }
    
    // Check if user is already assigned to another active counter
    const Counter = mongoose.model('Counter');
    const existingCounter = await Counter.findOne({
      assignedUser: this.assignedUser,
      isActive: true,
      _id: { $ne: this._id }
    });
    
    if (existingCounter) {
      next(new Error('User is already assigned to another active counter'));
    }
  }
  
  next();
});

// Pre-remove middleware
counterSchema.pre('remove', async function(next) {
  try {
    // Remove counter from group
    const Group = mongoose.model('Group');
    await Group.updateOne(
      { _id: this.group },
      { $pull: { counters: this._id } }
    );
    
    // Unassign user
    if (this.assignedUser) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(this.assignedUser, { $unset: { counter: "" } });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Counter", counterSchema);