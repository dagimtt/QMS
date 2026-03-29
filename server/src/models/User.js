import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
    ref: "Counter"
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

// Hash password before saving
userSchema.pre('save', function(next) {
  const user = this;
  
  // Only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) {
    return next();
  }
  
  // Generate salt and hash password
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      
      user.password = hash;
      next();
    });
  });
});

// Compare password method
userSchema.methods.comparePassword = function(candidatePassword) {
  const user = this;
  
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, user.password, function(err, isMatch) {
      if (err) reject(err);
      resolve(isMatch);
    });
  });
};

export default mongoose.model("User", userSchema);