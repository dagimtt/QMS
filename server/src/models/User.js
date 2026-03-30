import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["Admin", "Verifier", "Cashier", "Validator", "Supervisor", "Authorizer"],
    default: "Verifier"
  },
  counter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Counter",
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  refreshToken: String,
  lastLogin: Date
}, { 
  timestamps: true 
});

// NO pre-save middleware - we'll hash passwords in the controller

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

export default mongoose.model("User", userSchema);