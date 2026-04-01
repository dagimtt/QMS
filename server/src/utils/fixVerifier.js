import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Counter from "../models/Counter.js";

dotenv.config();

const fixvalidator = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // Find the validator user
    const user = await User.findOne({ email: "officer@qms.com" });
    
    if (!user) {
      console.log('❌ User not found. Creating new validator user...');
      
      // Find a counter for the validator
      const counter = await Counter.findOne({ type: "validator", isActive: true });
      
      // Hash password manually
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("validator123!", salt);
      
      // Create new validator user
      const newUser = new User({
        username: "officer",
        fullName: "Officer validator",
        email: "officer@qms.com",
        password: hashedPassword,
        role: "validator",
        counter: counter?._id || null,
        isActive: true
      });
      
      await newUser.save();
      console.log('✅ New validator user created!');
      console.log('   Email: officer@qms.com');
      console.log('   Password: validator123!');
      console.log('   Role: validator');
      
      if (counter) {
        console.log(`   Assigned to counter: ${counter.counterNumber}`);
      }
    } else {
      console.log('✅ User found:', user.email);
      console.log('   Role:', user.role);
      
      // Hash password manually
      const newPassword = "validator123!";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update user directly without triggering pre-save
      user.password = hashedPassword;
      await user.save();
      
      console.log('\n✅ Password reset successfully!');
      console.log('   New password:', newPassword);
      
      // Verify the password works
      const isValid = await bcrypt.compare(newPassword, user.password);
      console.log('   Password verification:', isValid ? '✅ PASSED' : '❌ FAILED');
    }
    
    // Also create a counter for the validator if needed
    const validatorCounter = await Counter.findOne({ type: "validator" });
    if (!validatorCounter) {
      console.log('\n📌 No validator counter found. Creating one...');
      
      // Find a group
      const group = await mongoose.connection.db.collection('groups').findOne({});
      if (!group) {
        console.log('❌ No group found. Please create a group first.');
        process.exit(1);
      }
      
      const newCounter = new Counter({
        counterNumber: "101",
        name: "Verification Counter",
        type: "validator",
        group: group._id,
        services: [],
        isActive: true,
        status: "Available"
      });
      
      await newCounter.save();
      console.log('✅ Counter created:', newCounter.counterNumber);
      console.log('   Counter ID:', newCounter._id);
      
      // Assign counter to user if user exists
      const userToUpdate = await User.findOne({ email: "officer@qms.com" });
      if (userToUpdate && !userToUpdate.counter) {
        userToUpdate.counter = newCounter._id;
        await userToUpdate.save();
        console.log('✅ Counter assigned to user');
      }
    }
    
    console.log('\n🎉 Fix completed!');
    console.log('\n📝 Login credentials:');
    console.log('   Email: officer@qms.com');
    console.log('   Password: validator123!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixvalidator();