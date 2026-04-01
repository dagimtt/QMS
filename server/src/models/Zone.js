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
    trim: true
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
    announcementVolume: { type: Number, default: 70 },
    displayRefreshInterval: { type: Number, default: 5 },
    audioEnabled: { type: Boolean, default: true }
  }
}, { timestamps: true });

// Method to get available counter by type within zone
zoneSchema.methods.getAvailableCounter = async function(counterType) {
  const Group = mongoose.model('Group');
  const Counter = mongoose.model('Counter');
  
  // Find all groups in this zone
  const groups = await Group.find({ zone: this._id });
  const groupIds = groups.map(g => g._id);
  
  // Find available counter of specified type in this zone
  const counter = await Counter.findOne({
    group: { $in: groupIds },
    type: counterType,
    isActive: true,
    status: 'Available'
  }).populate('group');
  
  return counter;
};

// Method to get all counters by type within zone
zoneSchema.methods.getCountersByType = async function(counterType) {
  const Group = mongoose.model('Group');
  const Counter = mongoose.model('Counter');
  
  const groups = await Group.find({ zone: this._id });
  const groupIds = groups.map(g => g._id);
  
  return await Counter.find({
    group: { $in: groupIds },
    type: counterType,
    isActive: true
  }).populate('group');
};

export default mongoose.model("Zone", zoneSchema);