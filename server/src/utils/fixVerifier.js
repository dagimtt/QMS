import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Counter from "../models/Counter.js";

dotenv.config();

const fixVerifier = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // Find the verifier user
    const user = await User.findOne({ email: "officer@qms.com" });
    
    if (!user) {
      console.log('❌ User not found. Creating new verifier user...');
      
      // Find a counter for the verifier
      const counter = await Counter.findOne({ type: "Verifier", isActive: true });
      
      // Hash password manually
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("Verifier123!", salt);
      
      // Create new verifier user
      const newUser = new User({
        username: "officer",
        fullName: "Officer Verifier",
        email: "officer@qms.com",
        password: hashedPassword,
        role: "Verifier",
        counter: counter?._id || null,
        isActive: true
      });
      
      await newUser.save();
      console.log('✅ New verifier user created!');
      console.log('   Email: officer@qms.com');
      console.log('   Password: Verifier123!');
      console.log('   Role: Verifier');
      
      if (counter) {
        console.log(`   Assigned to counter: ${counter.counterNumber}`);
      }
    } else {
      console.log('✅ User found:', user.email);
      console.log('   Role:', user.role);
      
      // Hash password manually
      const newPassword = "Verifier123!";
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
    
    // Also create a counter for the verifier if needed
    const verifierCounter = await Counter.findOne({ type: "Verifier" });
    if (!verifierCounter) {
      console.log('\n📌 No Verifier counter found. Creating one...');
      
      // Find a group
      const group = await mongoose.connection.db.collection('groups').findOne({});
      if (!group) {
        console.log('❌ No group found. Please create a group first.');
        process.exit(1);
      }
      
      const newCounter = new Counter({
        counterNumber: "101",
        name: "Verification Counter",
        type: "Verifier",
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
    console.log('   Password: Verifier123!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixVerifier();