import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Group code is required'],
    uppercase: true,
    trim: true,
    unique: true,
    maxlength: [10, 'Group code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: [true, 'Zone is required']
  },
  counters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counter'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  settings: {
    maxQueueLength: {
      type: Number,
      default: 50,
      min: 1,
      max: 500
    },
    estimatedWaitTime: {
      type: Number,
      default: 15,
      min: 1,
      max: 120
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Virtual for active counters count
groupSchema.virtual('activeCountersCount').get(function() {
  return this.counters?.filter(counter => counter.isActive).length || 0;
});

// Method to check if group can be deleted
groupSchema.methods.canDelete = async function() {
  const Counter = mongoose.model('Counter');
  const countersCount = await Counter.countDocuments({ group: this._id });
  return countersCount === 0;
};

// Method to get queue statistics
groupSchema.methods.getQueueStats = async function() {
  const Ticket = mongoose.model('Ticket');
  const stats = await Ticket.aggregate([
    { $match: { group: this._id, status: 'Waiting' } },
    { $group: {
      _id: null,
      totalWaiting: { $sum: 1 },
      averageWaitTime: { $avg: { $subtract: [new Date(), '$createdAt'] } }
    }}
  ]);
  return stats[0] || { totalWaiting: 0, averageWaitTime: 0 };
};

// Pre-remove middleware
groupSchema.pre('remove', async function(next) {
  try {
    const Counter = mongoose.model('Counter');
    const counters = await Counter.find({ group: this._id });
    if (counters.length > 0) {
      next(new Error('Cannot delete group with existing counters. Remove all counters first.'));
    }
    
    // Remove group reference from zone
    const Zone = mongoose.model('Zone');
    await Zone.updateOne(
      { _id: this.zone },
      { $pull: { groups: this._id } }
    );
    
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Group", groupSchema);