import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const createAdminFinal = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // Delete existing admin
    const deleted = await User.deleteMany({ email: 'admin@qms.com' });
    console.log('🗑️  Deleted existing admins:', deleted.deletedCount);
    
    // Create new admin user
    const admin = new User({
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@qms.com',
      password: 'Admin123!',
      role: 'Admin',
      isActive: true
    });
    
    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@qms.com');
    console.log('🔑 Password: Admin123!');
    
    // Verify the password works
    const savedUser = await User.findOne({ email: 'admin@qms.com' });
    const isValid = await savedUser.comparePassword('Admin123!');
    console.log('\n🔐 Password verification:', isValid ? '✅ PASSED' : '❌ FAILED');
    
    if (isValid) {
      console.log('\n🎉 SUCCESS! You can now login with:');
      console.log('Email: admin@qms.com');
      console.log('Password: Admin123!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createAdminFinal();