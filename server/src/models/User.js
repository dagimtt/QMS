import mongoose from "mongoose";

// Define role permissions mapping
export const rolePermissions = {
  'Admin': [
    'view_dashboard', 'view_tickets', 'manage_zones', 'manage_groups', 
    'manage_counters', 'manage_services', 'manage_users', 'view_reports',
    'manage_escalations', 'view_escalations', 'call_tickets', 'complete_tickets',
    'mark_absent', 'escalate_tickets', 'view_counter_dashboard'
  ],
  'Supervisor': [
    'view_dashboard', 'view_tickets', 'view_reports', 'manage_escalations',
    'view_escalations', 'call_tickets', 'complete_tickets', 'mark_absent',
    'escalate_tickets', 'view_counter_dashboard'
  ],
  'Verifier': [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 
    'mark_absent', 'escalate_tickets'
  ],
  'Validator': [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 
    'mark_absent', 'escalate_tickets'
  ],
  'Authorizer': [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 
    'mark_absent', 'escalate_tickets'
  ],
  'Cashier': [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 
    'mark_absent', 'escalate_tickets'
  ]
};

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
    enum: ["Admin", "Supervisor", "Verifier", "Validator", "Authorizer", "Cashier"],
    required: true,
    default: "Verifier"
  },
  permissions: {
    type: [String],
    default: []
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

// Set permissions based on role before saving
userSchema.pre('save', async function(next) {
  // If permissions are not explicitly set, use role defaults
  if (!this.permissions || this.permissions.length === 0) {
    this.permissions = rolePermissions[this.role] || [];
  }
  next();
});

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

// Check if user has a specific permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'Admin';
};

export default mongoose.model("User", userSchema);