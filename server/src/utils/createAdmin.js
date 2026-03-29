import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('Connected to MongoDB');
    
    // Delete existing admin if exists
    const deleted = await User.deleteOne({ email: 'admin@qms.com' });
    console.log('Deleted existing admin:', deleted.deletedCount > 0 ? 'Yes' : 'No');
    
    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin123!', salt);
    console.log('Hashed password created:', hashedPassword);
    
    // Create new admin user
    const admin = new User({
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@qms.com',
      password: hashedPassword,
      role: 'Admin',
      isActive: true
    });
    
    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@qms.com');
    console.log('🔑 Password: Admin123!');
    
    // Verify password works
    const user = await User.findOne({ email: 'admin@qms.com' });
    const isValid = await bcrypt.compare('Admin123!', user.password);
    console.log('Password verification test:', isValid ? '✅ PASSED' : '❌ FAILED');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetAdmin();