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

export default mongoose.model("Counter", counterSchema);