import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const directInsertAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Delete existing admin
    const deleted = await usersCollection.deleteOne({ email: 'admin@qms.com' });
    console.log('🗑️  Deleted existing admin:', deleted.deletedCount > 0 ? 'Yes' : 'No');
    
    // Generate hash for Admin123!
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin123!', salt);
    console.log('🔑 Generated hash:', hashedPassword);
    
    // Create new admin directly in database
    const newAdmin = {
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@qms.com',
      password: hashedPassword,
      role: 'Admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await usersCollection.insertOne(newAdmin);
    console.log('✅ Admin user inserted directly into database!\n');
    
    // Verify
    const savedUser = await usersCollection.findOne({ email: 'admin@qms.com' });
    const isValid = await bcrypt.compare('Admin123!', savedUser.password);
    
    console.log('📋 Verification:');
    console.log('Email:', savedUser.email);
    console.log('Full Name:', savedUser.fullName);
    console.log('Role:', savedUser.role);
    console.log('Password hash:', savedUser.password);
    console.log('Password valid:', isValid ? '✅ YES' : '❌ NO');
    
    if (isValid) {
      console.log('\n🎉 SUCCESS! You can now login with:');
      console.log('Email: admin@qms.com');
      console.log('Password: Admin123!');
    } else {
      console.log('\n❌ Something went wrong. Password validation failed.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

directInsertAdmin();