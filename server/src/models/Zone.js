import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: [true, 'Zone code is required'],
    uppercase: true,
    trim: true,
    unique: true,
    maxlength: [10, 'Zone code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  displayScreen: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^(http|https):\/\/[^ "]+$/.test(v);
      },
      message: 'Invalid URL format for display screen'
    }
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    announcementVolume: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    },
    displayRefreshInterval: {
      type: Number,
      default: 5,
      min: 1,
      max: 60
    },
    audioEnabled: {
      type: Boolean,
      default: true
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Virtual for total counters in zone
zoneSchema.virtual('totalCounters').get(async function() {
  if (!this.groups || this.groups.length === 0) return 0;
  const Group = mongoose.model('Group');
  const groups = await Group.find({ _id: { $in: this.groups } });
  return groups.reduce((sum, group) => sum + (group.counters?.length || 0), 0);
});

// Method to check if zone can be deleted
zoneSchema.methods.canDelete = async function() {
  const Group = mongoose.model('Group');
  const groupsCount = await Group.countDocuments({ zone: this._id });
  return groupsCount === 0;
};

// Pre-remove middleware
zoneSchema.pre('remove', async function(next) {
  try {
    const Group = mongoose.model('Group');
    const groups = await Group.find({ zone: this._id });
    if (groups.length > 0) {
      next(new Error('Cannot delete zone with existing groups. Remove all groups first.'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Zone", zoneSchema);