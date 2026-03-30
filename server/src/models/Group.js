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

export default mongoose.model("Group", groupSchema);