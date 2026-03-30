import mongoose from "mongoose";
import dotenv from "dotenv";
import Zone from "../models/Zone.js";
import Group from "../models/Group.js";
import Counter from "../models/Counter.js";

dotenv.config();

const fixZoneGroupComplete = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qms');
    console.log('✅ Connected to MongoDB\n');
    
    // Check if zone exists
    let zone = await Zone.findOne({ code: "MAIN" });
    
    if (!zone) {
      console.log('📌 Creating default zone...');
      zone = new Zone({
        name: "Main Hall",
        code: "MAIN",
        description: "Main service area",
        isActive: true,
        groups: []
      });
      await zone.save();
      console.log('✅ Zone created:', zone.name);
      console.log('   Zone ID:', zone._id);
    } else {
      console.log('✅ Zone found:', zone.name);
      console.log('   Zone ID:', zone._id);
    }
    
    // Find and update the group
    const groupId = "69ca1242a6c988e433fec102";
    const group = await Group.findById(groupId);
    
    if (!group) {
      console.log('❌ Group not found with ID:', groupId);
      process.exit(1);
    }
    
    console.log('\n📌 Group found:', group.name);
    console.log('   Current zone:', group.zone);
    
    // Update group with zone
    if (!group.zone || group.zone.toString() !== zone._id.toString()) {
      group.zone = zone._id;
      await group.save();
      console.log('✅ Group zone updated to:', zone._id);
    } else {
      console.log('✅ Group already has correct zone');
    }
    
    // Add group to zone if not already
    if (!zone.groups.includes(group._id)) {
      zone.groups.push(group._id);
      await zone.save();
      console.log('✅ Group added to zone groups');
    } else {
      console.log('✅ Group already in zone groups');
    }
    
    // Check counters
    const counters = await Counter.find({ group: group._id });
    console.log('\n📊 Counters in this group:', counters.length);
    
    counters.forEach(counter => {
      console.log(`   - Counter ${counter.counterNumber}: Type=${counter.type}, Status=${counter.status}`);
    });
    
    console.log('\n========================================');
    console.log('🎉 FIX COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('Zone:', zone.name, `(${zone.code})`);
    console.log('Group:', group.name, `(${group.code})`);
    console.log('Zone ID:', zone._id);
    console.log('Group ID:', group._id);
    console.log('\n💡 You can now create tickets!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixZoneGroupComplete();